#!/usr/bin/env python3
"""Build the US drug-name pack from an RxNorm Current Prescribable Content release.

    python3 build_rxnorm_pack.py ../RxNorm_full_prescribe_10052026 out/ [tall-man.csv]

Reads RXNCONSO, RXNREL and RXNSAT. Keeps only SAB=RXNORM rows, so the MTHSPL label
data and the MTHCMSFRF supply rows never reach the pack. Writes one JSON pack plus a
manifest with its SHA-256, and a slim copy for the app (`.app.json`) that keeps only the
fields the app reads. Given FDA's Tall Man list (CSV: group, established_name,
tall_man_name), names FDA groups together become look-alike pairs (`lasa`), kept only
where both names are generics in the pack. Standard library only.

The pack is grouped the way the app's matcher reads drugs (src/core/drugs.ts):
one entry per generic (ingredient set) with `n` the generic name, `s` its strengths
and `b` its brand names. Each entry also lists its clinical drugs (`p`) with their
RxCUIs, so a confirmed match resolves to an RxCUI, never to free text.
"""
import csv
import hashlib
import itertools
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ATTRIBUTION = (
    "This product uses publicly available data courtesy of the U.S. National Library of "
    "Medicine (NLM), National Institutes of Health, Department of Health and Human Services; "
    "NLM is not responsible for the product and does not endorse or recommend this or any "
    "other product."
)
SOURCE = "https://www.nlm.nih.gov/research/umls/rxnorm/docs/prescribe.html"

# RxNorm writes units in capitals. The app compares strengths in lower case, and shows them.
UNITS = {"ML": "mL", "UNT": "units", "MEQ": "mEq", "ACTUAT": "actuation", "HR": "hr", "CELLS": "cells"}


def rows(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            yield line.rstrip("\n").split("|")


def unit(u):
    return "/".join(UNITS.get(p, p.lower()) for p in u.split("/"))


def strength(raw):
    """RXN_STRENGTH is always '<number> <unit>': '5 MG' -> '5 mg', '100 UNT/ML' -> '100 units/mL'.
    RxNorm states micrograms as MG ('0.025 MG' for 25 mcg); the value is kept as RxNorm gives it."""
    num, _, u = raw.partition(" ")
    return f"{num} {unit(u)}" if u else raw


def lasa_pairs(csv_path, generics):
    groups = defaultdict(set)
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            groups[row["group"]].add(row["established_name"].strip().lower())
    pairs = set()
    for names in groups.values():
        for a, b in itertools.combinations(sorted(n for n in names if n in generics), 2):
            pairs.add((a, b))
    return sorted(pairs)


def main(release_dir, out_dir, tallman_csv=None):
    rrf = Path(release_dir) / "rrf"
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    m = re.search(r"(\d{2})(\d{2})(\d{4})", Path(release_dir).name)
    release = f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else "unknown"

    # RXNCONSO: names by term type, RXNORM only.
    tty_of, name, psn, tallman = {}, {}, {}, {}
    skipped_sab = defaultdict(int)
    for r in rows(rrf / "RXNCONSO.RRF"):
        cui, sab, tty, s, suppress = r[0], r[11], r[12], r[14], r[16]
        if sab != "RXNORM":
            skipped_sab[sab] += 1
            continue
        if suppress != "N":
            continue
        if tty in ("IN", "PIN", "MIN", "SCD", "SBD", "SCDC", "BN", "DF"):
            tty_of[cui] = tty
            name[cui] = s
        elif tty == "PSN":
            psn[cui] = s
        elif tty == "TMSY":
            tallman[cui] = s

    # RXNSAT: human-drug flag, component strengths.
    human, vet, comp_strength = set(), set(), {}
    for r in rows(rrf / "RXNSAT.RRF"):
        if r[9] != "RXNORM":
            continue
        if r[8] == "RXN_HUMAN_DRUG":
            human.add(r[0])
        elif r[8] == "RXN_VET_DRUG":
            vet.add(r[0])
        elif r[8] == "RXN_STRENGTH":
            comp_strength[r[0]] = r[10]

    # RXNREL: a row reads "RXCUI2 <RELA> RXCUI1".
    components, form, brands_of, ingredients, brand_name = (defaultdict(list) for _ in range(5))
    for r in rows(rrf / "RXNREL.RRF"):
        if r[10] != "RXNORM":
            continue
        a, rela, b = r[0], r[7], r[4]
        ta, tb = tty_of.get(a), tty_of.get(b)
        if ta == "SCD" and rela == "constitutes" and tb == "SCDC":
            components[a].append(b)
        elif ta == "SCD" and rela == "dose_form_of" and tb == "DF":
            form[a].append(b)
        elif ta == "SCD" and rela == "tradename_of" and tb == "SBD":
            brands_of[a].append(b)
        elif ta == "SCDC" and rela == "ingredient_of" and tb == "IN":
            ingredients[a].append(b)
        elif ta == "SBD" and rela == "ingredient_of" and tb == "BN":
            brand_name[a].append(b)

    groups = defaultdict(lambda: {"products": [], "brands": {}})
    excluded = defaultdict(list)
    scds = [c for c, t in tty_of.items() if t == "SCD"]
    for scd in scds:
        # Drop veterinary-only drugs. A drug with neither flag (no current US marketing
        # data) stays: leaving a real drug out would turn its prescriptions Red.
        if scd in vet and scd not in human:
            excluded["veterinary only"].append(scd)
            continue
        comps = components.get(scd, [])
        if not comps or any(len(ingredients.get(c, [])) != 1 for c in comps):
            excluded["no single ingredient per component"].append(scd)
            continue
        pairs = sorted((name[ingredients[c][0]], ingredients[c][0], comp_strength.get(c, "")) for c in comps)
        if any(not p[2] for p in pairs):
            excluded["component without a strength"].append(scd)
            continue
        key = tuple(p[1] for p in pairs)
        g = groups[key]
        g["names"] = [p[0] for p in pairs]
        sbds = []
        for sbd in sorted(brands_of.get(scd, [])):
            for bn in brand_name.get(sbd, []):
                g["brands"][bn] = name[bn]
                sbds.append({"rxcui": sbd, "bn": name[bn], "name": name[sbd]})
        g["products"].append({
            "rxcui": scd,
            "s": " / ".join(strength(p[2]) for p in pairs),
            "f": name[form[scd][0]] if form.get(scd) else "",
            "name": name[scd],
            "psn": psn.get(scd, ""),
            "tm": tallman.get(scd, ""),
            "sbd": sbds,
        })

    drugs = []
    for key, g in groups.items():
        n = " / ".join(g["names"])
        # Tall Man for the generic: the matching stretch of any product's TMSY name.
        tm = next((p["tm"][: len(n)] for p in g["products"] if p["tm"][: len(n)].lower() == n.lower() and p["tm"][: len(n)] != n), "")
        products = sorted(g["products"], key=lambda p: (p["f"], p["s"]))
        strengths = list(dict.fromkeys(p["s"] for p in sorted(products, key=lambda p: [float(x) if x.replace(".", "", 1).isdigit() else 0 for x in re.findall(r"[\d.]+", p["s"])[:1]])))
        drugs.append({
            "n": n.lower(),
            "tm": tm,
            "in": list(key),
            "s": strengths,
            "b": sorted({b.lower() for b in g["brands"].values()}),
            "p": products,
        })
    drugs.sort(key=lambda d: d["n"])

    counts = {
        "generics": len(drugs),
        "single_ingredient": sum(1 for d in drugs if len(d["in"]) == 1),
        "clinical_drugs": sum(len(d["p"]) for d in drugs),
        "branded_drugs": sum(len(p["sbd"]) for d in drugs for p in d["p"]),
        "brand_names": len({b for d in drugs for b in d["b"]}),
        "scd_in_release": len(scds),
        "scd_excluded": {k: len(v) for k, v in excluded.items()},
        "scd_without_human_or_vet_flag": sum(1 for c in scds if c not in human and c not in vet),
        "rows_skipped_by_source": dict(skipped_sab),
    }
    lasa = lasa_pairs(tallman_csv, {d["n"] for d in drugs}) if tallman_csv else []
    counts["lasa_pairs"] = len(lasa)
    pack = {
        "pack": "rxnorm-us",
        "release": release,
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE,
        "attribution": ATTRIBUTION,
        "currency": f"Drug names from the RxNorm release of {release}. Newer releases may add or change drugs.",
        "counts": counts,
        "lasa": lasa,
        "lasa_source": Path(tallman_csv).name if tallman_csv else None,
        "drugs": drugs,
    }

    body = json.dumps(pack, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    pack_path = out / f"rxnorm-us-{release}.json"
    pack_path.write_bytes(body)
    manifest = {
        "file": pack_path.name,
        "bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
        "release": release,
        "built": pack["built"],
        "signed": False,
        "counts": counts,
        "excluded_scd_examples": {k: [f"{c} {name[c]}" for c in v[:5]] for k, v in excluded.items()},
    }
    # The app copy: per product only RxCUI, strength and dose form.
    slim = {k: v for k, v in pack.items() if k not in ("drugs", "counts")}
    slim["drugs"] = [{"n": d["n"], "s": d["s"], "b": d["b"], "p": [[p["rxcui"], p["s"], p["f"]] for p in d["p"]]} for d in drugs]
    slim_body = json.dumps(slim, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    slim_path = out / f"rxnorm-us-{release}.app.json"
    slim_path.write_bytes(slim_body)
    manifest["app_file"] = {"file": slim_path.name, "bytes": len(slim_body), "sha256": hashlib.sha256(slim_body).hexdigest()}
    (out / f"rxnorm-us-{release}.manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(*sys.argv[1:])
