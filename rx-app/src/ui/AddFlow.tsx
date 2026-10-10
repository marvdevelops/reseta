import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { blockers, buildDraft, CRITICAL, type Field as DraftField, type FieldKey, type Fields, type Line } from '../core/draft';
import { FREQ_CODES, FREQ_WORDS, timesFor, type FreqCode } from '../core/sig';
import { makeSample, uid, type Card as RxCard, type Store } from '../core/model';
import { PH_SAMPLE, type DrugList } from '../core/druglist';
import { tallMan } from '../core/match';
import { loadDrugList } from '../drugLists';
import { cropLine, downscale } from '../platform/crop';
import { ocrAvailable, readLine } from '../platform/ocr';
import { scanDocument, scannerAvailable } from '../platform/scan';
import { customWords, looksLikeMedicineLine, pickReading, readersDisagree } from '../core/reading';
import { findLines, pageToolsAvailable, straighten, type FoundLine } from '../platform/vision';
import { aiInstalled, aiReady, aiSupported, readLineAI, releaseAI } from '../platform/localAI';
import {
  Body, BodyBold, BodyLg, Button, Caption, Card, ChoiceGroup, Dose, Field, FieldCheck, Heading, Icon, Label, Notice, R, S, Stack, StepHeader,
  T, TimePicker, TwoTapChoice, useColors,
} from './kit';
import { cap, fmtTime, forWhom, isMe, plainDose, takeLine, you } from './format';

type Photo = { uri: string; width: number; height: number };
type Found = FoundLine & { id: string };
type Props = { store: Store; update: (fn: (s: Store) => Store) => void; onSaved: (c: RxCard) => void; onCancel: () => void; toast: (m: string) => void };
const TOTAL = 4;
const ORDER: FieldKey[] = ['drug', 'strength', 'dose', 'freq', 'days', 'food'];

export default function AddFlow({ store, update, onSaved, onCancel, toast }: Props) {
  const c = useColors();
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState(store.people[0]?.id ?? '');
  const [newName, setNewName] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [typing, setTyping] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [fields, setFields] = useState<Fields | null>(null);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [pill, setPill] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [found, setFound] = useState<Found[] | null>(null);
  const [manual, setManual] = useState(false);
  // The AI model holds about 2.5 GB while loaded: free it when the flow closes.
  useEffect(() => () => { releaseAI(); }, []);
  const scroll = useRef<ScrollView>(null);

  // Every change to the lines goes through a functional update, so async work (cropping, reading)
  // always lands on the newest list. The draft is rebuilt from whatever the lines are now.
  const linesRef = useRef<Line[]>([]);
  linesRef.current = lines;
  const [list, setList] = useState<DrugList>(PH_SAMPLE);
  useEffect(() => {
    let live = true;
    loadDrugList(store.drugList).then((l) => { if (live) setList(l); }, () => toast('The US medicine list could not load. Using the Philippine list.'));
    return () => { live = false; };
  }, [store.drugList, toast]);
  // The US list has about 3,300 generics, so wait for typing to pause before matching.
  // The draft is only rebuilt while the user is still on the lines; on the check step their confirmations stay.
  useEffect(() => {
    if (step > 2) return;
    if (list.drugs.length < 500) { setFields(buildDraft(lines, list)); return; }
    const t = setTimeout(() => setFields(buildDraft(lines, list)), 250);
    return () => clearTimeout(t);
  }, [lines, list, step]);

  const hints = useMemo(() => customWords(list.drugs), [list]);
  const reading = useRef(false);
  // On the phone, read each line as soon as it is marked.
  useEffect(() => {
    if (Platform.OS !== 'web' && ocrAvailable && !reading.current && lines.some((l) => l.crop && !l.read)) readAll();
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => {
    if (n === 4 && fields && person) {
      const code = fields.freq.value.toUpperCase() as FreqCode;
      setTimes(code && code !== 'PRN' ? timesFor(code, person) : []);
    }
    setStep(n); setEditing(null); scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const person = store.people.find((p) => p.id === personId) ?? store.people[0];

  /** Straightens the page (photos from the library), finds every line, and picks the ones that look like medicine. */
  async function usePage(p: Photo, fromScanner: boolean) {
    setTyping(false); setLines([]); setFound(null); setManual(false); setPhoto(null);
    setBusy('Getting the page ready…');
    try {
      let page = p;
      if (!fromScanner) {
        const s = await straighten(p);
        page = { uri: s.uri, width: s.width, height: s.height };
      }
      page = await downscale(page.uri, page.width, page.height, 2000);
      setPhoto(page);
      if (!pageToolsAvailable) { setManual(true); setBusy(''); return; }
      setBusy('Finding the lines of writing…');
      const f: Found[] = (await findLines(page.uri)).map((l) => ({ ...l, id: uid() }));
      setFound(f);
      setLines(f.filter((l) => looksLikeMedicineLine(l.text, list.drugs)).map((l) => ({ id: l.id, crop: l.crop, text: '', read: false, typed: false })));
      if (!f.length) { setManual(true); setBusy('No writing was found. Mark the lines yourself, or take the picture again in better light.'); }
      else setBusy('');
    } catch {
      setManual(true);
      setBusy('Reseta could not find the lines. Mark each medicine line yourself.');
    }
  }

  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    await usePage({ uri: a.uri, width: a.width, height: a.height }, false);
  }

  async function scan() {
    try {
      const p = await scanDocument();
      if (p) await usePage(p, true);
    } catch { toast('The scanner could not open. Choose a photo instead.'); }
  }

  /** Adds or removes a found line, keeping the lines in the order they are written on the paper. */
  function toggle(l: Found) {
    setLines((prev) => {
      if (prev.some((x) => x.id === l.id)) return prev.filter((x) => x.id !== l.id);
      const order = (id: string) => { const i = found?.findIndex((f) => f.id === id) ?? -1; return i < 0 ? 1e9 : i; };
      return [...prev, { id: l.id, crop: l.crop, text: '', read: false, typed: false }].sort((a, b) => order(a.id) - order(b.id));
    });
  }

  async function addBox(rect: { x: number; y: number; width: number; height: number }) {
    if (!photo) return;
    const crop = await cropLine(photo.uri, rect);
    setLines((prev) => [...prev, { id: uid(), crop, text: '', read: false, typed: false }]);
  }

  async function readAll() {
    if (reading.current) return;
    reading.current = true;
    try {
      // Keep reading until no unread boxed line is left, including boxes added while reading.
      const done = new Set<string>();
      for (;;) {
        const l = linesRef.current.find((x) => x.crop && !x.read && !done.has(x.id));
        if (!l) break;
        done.add(l.id);
        const n = linesRef.current.indexOf(l) + 1;
        setBusy(Platform.OS === 'web' ? `Reading line ${n} of ${linesRef.current.length}. The first time takes longer.` : `Reading line ${n}…`);
        const r = await readLine(l.crop!, hints);
        const pick = r?.variants?.length ? pickReading(r.variants, list.drugs) : r ? { text: r.text, altPicked: false } : null;
        let alt: string | null = null;
        if (aiReady()) {
          setBusy(`The AI reader is checking line ${n}…`);
          try { alt = await readLineAI(l.crop!); } catch { alt = null; }
        }
        const visionText = pick?.text ?? '';
        const text = visionText || alt || '';
        setLines((prev) => prev.map((x) => (x.id === l.id ? {
          ...x, read: true, machine: r?.text, conf: r?.confidence, alt: alt ?? undefined,
          text: x.typed ? x.text : text,
          altPicked: !!pick?.altPicked || (!visionText && !!alt),
          disagree: !!alt && !!visionText && readersDisagree(visionText, alt, list.drugs),
        } : x)));
      }
      setBusy('');
    } catch {
      setBusy('The phone could not read the lines. Type each line instead.');
    } finally {
      reading.current = false;
    }
  }

  const editLine = (id: string, text: string) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text, typed: true } : l)));
  const addTypedLine = () => setLines((prev) => [...prev, { id: uid(), crop: null, text: '', read: true, typed: true }]);
  function patch(key: FieldKey, p: Partial<DraftField>) {
    setFields((f) => (f ? { ...f, [key]: { ...f[key], ...p } } : f));
  }

  const problems = useMemo(() => (fields ? blockers(fields) : []), [fields]);
  const cropOf = (lineId: string | null) => lines.find((l) => l.id === lineId)?.crop ?? null;
  const hasText = lines.some((l) => l.text.trim());

  function addPerson() {
    const name = newName.trim();
    if (!name) return;
    const p = { id: uid(), name, wake: '07:00', bed: '21:00' };
    update((s) => ({ ...s, people: [...s.people, p] }));
    setPersonId(p.id);
    setNewName('');
  }

  function saveSampleOnly() {
    if (!store.consent) return;
    const s = makeSample(lines, fields, store.consent, false, `${Platform.OS} ${Platform.Version}`);
    if (!s) return;
    update((st) => ({ ...st, samples: [...st.samples, s] }));
    toast('Kept as a test sample on this phone.');
  }

  async function pickPill() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setPill((await downscale(r.assets[0].uri, r.assets[0].width, r.assets[0].height, 800)).uri);
  }

  function save() {
    if (!fields || problems.length || !person) return;
    const code = fields.freq.value.toUpperCase() as FreqCode;
    const card: RxCard = {
      id: uid(), personId: person.id, drug: fields.drug.value, strength: fields.strength.value, dose: fields.dose.value, freq: code,
      days: Number(fields.days.value) || 0, food: fields.food.value, start: new Date().toISOString().slice(0, 10),
      times: code === 'PRN' ? [] : [...new Set(times)].sort(), every2: code === 'QOD',
      drugCrop: cropOf(fields.drug.lineId), pill, lines: lines.map((l) => l.text), handwritten: lines.some((l) => l.crop),
      confirmedAt: new Date().toISOString(), version: 1, drugList: list.id,
    };
    const rxcui = list.rxcuiFor?.(card.drug, card.strength);
    if (rxcui) card.rxcui = rxcui;
    const consent = store.consent;
    const sample = consent ? makeSample(lines, fields, consent, true, `${Platform.OS} ${Platform.Version}`) : null;
    update((st) => ({ ...st, cards: [...st.cards, card], samples: sample ? [...st.samples, sample] : st.samples }));
    onSaved(card);
  }

  // ---------- Step 1: who ----------
  const stepWho = (
    <Stack gap={S[5]}>
      <StepHeader step={1} total={TOTAL} title="Who is this medicine for?" onBack={onCancel} backTitle="Cancel" />
      <ChoiceGroup value={personId} onChange={setPersonId}
        options={store.people.map((p) => ({ value: p.id, label: p.name, hint: `Wakes ${fmtTime(p.wake)}, sleeps ${fmtTime(p.bed)}` }))} />
      <Card>
        <BodyBold>Someone else?</BodyBold>
        <Field label="Their name" value={newName} onChangeText={setNewName} placeholder="For example, Lola Rosa" autoCapitalize="words" returnKeyType="done" onSubmitEditing={addPerson} />
        <Button variant="secondary" size="md" icon="plus" title="Add this person" disabled={!newName.trim()} onPress={addPerson} />
      </Card>
    </Stack>
  );

  // ---------- Step 2: the paper ----------
  const picked = (id: string) => lines.find((x) => x.id === id);
  const lineCard = (l: Line, title: string) => (
    <Stack gap={S[2]}>
      <Field label={title} value={l.text} onChangeText={(t) => editLine(l.id, t)} placeholder={l.read ? 'What does this line say?' : 'Reading…'} multiline />
      {l.disagree && l.alt ? (
        <Notice tone="look" title="The two readers saw different things">
          <Stack gap={S[2]}>
            <Body color="#14213D">{`The AI reader saw: "${l.alt}". Look at the paper and fix the line above if needed.`}</Body>
            <Button variant="secondary" size="md" title="Use the AI reading" onPress={() => editLine(l.id, l.alt!)} />
          </Stack>
        </Notice>
      ) : null}
    </Stack>
  );
  const stepPaper = (
    <Stack gap={S[5]}>
      <StepHeader step={2} total={TOTAL} title={typing ? 'Type the prescription' : photo ? 'Pick the medicine lines' : 'Scan the prescription'} onBack={() => go(1)} />
      {!photo && !typing && !busy ? (
        <>
          <BodyLg>{scannerAvailable ? 'Hold the phone over the paper. The scanner finds the edges, straightens the page and takes the picture for you.' : 'Choose a clear photo of the whole prescription.'}</BodyLg>
          <Stack>
            {scannerAvailable ? <Button icon="camera" title="Scan the prescription" onPress={scan} /> : null}
            <Button variant={scannerAvailable ? 'secondary' : 'primary'} icon="image" title="Choose a photo" onPress={pick} />
            <Button variant="quiet" icon="type" title="Type it instead" onPress={() => { setTyping(true); if (!lines.length) addTypedLine(); }} />
          </Stack>
          {aiSupported && !aiInstalled() && pageToolsAvailable ? <Caption muted>Tip: turn on the AI reader under More. It double-checks the handwriting, right on this phone.</Caption> : null}
        </>
      ) : null}
      {busy ? <Notice tone="info">{busy}</Notice> : null}
      {photo && found?.length ? (
        <>
          <BodyLg>Tap each line that is part of the medicine. Reseta picked the ones that look like medicine. Leave out names and addresses.</BodyLg>
          {found.map((f) => {
            const l = picked(f.id);
            return (
              <View key={f.id} style={{ backgroundColor: c.surface, borderRadius: R.lg, borderWidth: 2, borderColor: l ? c.tinta : c.line, padding: S[3], gap: S[3] }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!l }} accessibilityLabel={`Line: ${f.text}`} onPress={() => toggle(f)}
                  style={({ pressed }) => ({ gap: S[2], opacity: pressed ? 0.8 : 1 })}>
                  <Image source={{ uri: f.crop }} style={{ width: '100%', height: 64, resizeMode: 'contain', backgroundColor: '#FFFFFF', borderRadius: R.sm }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[2], minHeight: 44 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: l ? c.tinta : c.lineStrong, backgroundColor: l ? c.tinta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {l ? <Icon name="check" size={22} color={c.onTinta} /> : null}
                    </View>
                    <Text style={[T.bodyBold, { color: l ? c.tinta : c.inkMuted, flex: 1 }]}>{l ? 'Medicine line' : 'Not used. Tap to add'}</Text>
                  </View>
                </Pressable>
                {l ? lineCard(l, 'What it says') : null}
              </View>
            );
          })}
        </>
      ) : null}
      {photo ? (
        manual ? (
          <>
            <BodyLg>Drag your finger around each medicine line Reseta missed. Leave out the patient's name.</BodyLg>
            <LineMarker photo={photo} onBox={addBox} />
          </>
        ) : <Button variant="quiet" size="md" title="Reseta missed a line? Mark it yourself" onPress={() => setManual(true)} />
      ) : null}
      {photo ? lines.filter((l) => !found?.some((f) => f.id === l.id)).map((l, i) => (
        <Card key={l.id}>
          {l.crop ? <Image source={{ uri: l.crop }} accessibilityLabel={`Line you marked ${i + 1}`} style={{ width: '100%', height: 72, resizeMode: 'contain', backgroundColor: '#FFFFFF', borderRadius: R.sm }} /> : null}
          {lineCard(l, `Line you marked ${i + 1}`)}
          <Button variant="quiet" size="md" title="Remove this line" onPress={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} />
        </Card>
      )) : null}
      {typing ? (
        <>
          <BodyLg>Type each medicine line exactly as the paper says, for example "Amlodipine 5 mg, 1 tab OD x 30 days".</BodyLg>
          {lines.map((l, i) => (
            <Card key={l.id}>
              <Field label={`Line ${i + 1}`} value={l.text} onChangeText={(t) => editLine(l.id, t)} placeholder="Type the line" multiline />
              <Button variant="quiet" size="md" title="Remove this line" onPress={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} />
            </Card>
          ))}
          <Button variant="secondary" size="md" icon="plus" title="Add another line" onPress={addTypedLine} />
        </>
      ) : null}
      {photo || typing ? <Button variant="quiet" size="md" title={typing ? 'Start again' : 'Start again with a new picture'} onPress={() => { setPhoto(null); setTyping(false); setLines([]); setFound(null); setManual(false); setBusy(''); }} /> : null}
      {store.consent && lines.some((l) => l.crop && l.text.trim()) ? <Button variant="quiet" size="md" title="Keep as a test sample only" onPress={saveSampleOnly} /> : null}
    </Stack>
  );

  // ---------- Step 3: check each line ----------
  const checkField = (key: FieldKey) => {
    if (!fields) return null;
    const f = fields[key];
    // A value the user typed from the label can be confirmed even if the reading was blocked.
    const state = f.state === 'r' && f.edited ? 'a' : f.state;
    const isFreq = key === 'freq';
    const shown = isFreq && f.value ? `${FREQ_WORDS[f.value.toUpperCase() as FreqCode] ?? f.value}` : key === 'dose' && f.value ? plainDose(f.value) : key === 'days' && f.value ? `${f.value} days` : f.value;
    const label = f.label + (CRITICAL.includes(key) ? '' : ' (if written)');
    const open = editing === key || (state === 'r' && !f.value && !f.choices?.length);
    return (
      <FieldCheck key={key} label={label} value={f.choices?.length ? '' : shown} mono={key === 'strength' || key === 'dose'} state={state} reason={f.reason}
        crop={cropOf(f.lineId)} confirmed={f.confirmed} matchDisabled={!!f.choices?.length || (CRITICAL.includes(key) && !f.value) || (f.mustType && !f.edited)}
        onMatch={() => { patch(key, { confirmed: true }); setEditing(null); scroll.current?.scrollTo({ y: 0, animated: true }); }}
        onChange={() => { patch(key, { confirmed: false }); setEditing(editing === key ? null : key); }}>
        {f.choices?.length ? (
          <Stack>
            <BodyBold>Ask your pharmacist which one, then tap it twice.</BodyBold>
            {f.choices.map((ch) => (
              <TwoTapChoice key={ch} title={tallMan(ch, f.choices!.find((x) => x !== ch)!).split(' / ')[0]} armed={`Yes, the pharmacist said ${ch}`}
                onConfirm={() => patch(key, { value: ch, edited: true, choices: null, state: 'a', reason: 'You chose this after asking the pharmacist.', confirmed: false })} />
            ))}
          </Stack>
        ) : null}
        {open && !f.choices?.length ? (
          isFreq ? (
            <ChoiceGroup label="How often does the paper say?" value={f.value.toUpperCase()}
              onChange={(v) => patch('freq', { value: v, edited: true, confirmed: false })}
              options={FREQ_CODES.map((code) => ({ value: code, label: FREQ_WORDS[code], hint: code }))} />
          ) : (
            <Field label={f.mustType ? `Type the ${f.label.toLowerCase()} yourself` : `Type the ${f.label.toLowerCase()}`} mono={key === 'strength' || key === 'dose'}
              value={f.mustType && !f.edited ? '' : f.value} placeholder={f.mustType ? f.value : undefined}
              keyboardType={key === 'days' ? 'number-pad' : 'default'}
              onChangeText={(t) => patch(key, { value: t.trim(), edited: true, confirmed: false })} />
          )
        ) : null}
      </FieldCheck>
    );
  };
  // One field at a time: the first one that still needs the user, in reading order.
  const needs = (f: DraftField) => {
    const critical = CRITICAL.includes(f.key);
    return !!f.choices?.length || (critical && !f.value) || (f.state === 'r' && !f.edited) || (!!f.mustType && !f.edited)
      || (!f.confirmed && (critical || (!!f.value && f.state !== 'g')));
  };
  const current = fields ? (editing ?? ORDER.find((k) => needs(fields[k])) ?? null) : null;
  const done = fields ? ORDER.filter((k) => k !== current && (fields[k].confirmed || !needs(fields[k]))) : [];
  const valueWords = (k: FieldKey) => {
    const f = fields![k];
    if (!f.value) return 'Not written';
    return k === 'freq' ? FREQ_WORDS[f.value.toUpperCase() as FreqCode] ?? f.value : k === 'days' ? `${f.value} days` : k === 'dose' ? plainDose(f.value) : f.value;
  };
  const stepCheck = (
    <Stack gap={S[5]}>
      <StepHeader step={3} total={TOTAL} title="Check each line with the paper" onBack={() => go(2)} />
      {!fields ? <Notice tone="stop">Nothing to check yet. Go back and add the lines.</Notice> : current ? (
        <>
          <BodyLg>Look at the paper. Tap "Matches the paper" only when it says the same thing.</BodyLg>
          {checkField(current)}
        </>
      ) : <Notice tone="info" icon="check" title="Everything is checked">Look over the list below, then set the times.</Notice>}
      {list.id !== 'ph-sample' ? <Caption muted>Checking against: {list.label}.</Caption> : null}
      {done.length ? (
        <Card>
          <BodyBold>Checked</BodyBold>
          {done.map((k, i) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: S[3], borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingTop: i ? S[3] : 0 }}>
              <Icon name="check" size={24} color={c.ok} />
              <View style={{ flex: 1 }}>
                <Label muted>{fields![k].label}</Label>
                <BodyBold>{valueWords(k)}</BodyBold>
              </View>
              <Button variant="quiet" size="md" block={false} title="Change" a11yHint={`Change ${fields![k].label.toLowerCase()}`}
                onPress={() => { patch(k, { confirmed: false }); setEditing(k); scroll.current?.scrollTo({ y: 0, animated: true }); }} />
            </View>
          ))}
        </Card>
      ) : null}
    </Stack>
  );

  // ---------- Step 4: times ----------
  const code = (fields?.freq.value.toUpperCase() ?? '') as FreqCode;
  const stepTimes = fields && person ? (
    <Stack gap={S[5]}>
      <StepHeader step={4} total={TOTAL} title="When should Reseta remind you?" onBack={() => go(3)} />
      <Card>
        <Label muted>{forWhom(person.name)}</Label>
        <Heading>{takeLine(fields.dose.value, fields.food.value)}</Heading>
        <BodyLg>{cap(fields.drug.value)} {fields.strength.value}</BodyLg>
        <Body>{`${cap(FREQ_WORDS[code] ?? code)}${Number(fields.days.value) ? `, for ${fields.days.value} days` : ''}.`}</Body>
      </Card>
      {times.length ? (
        <Stack>
          <BodyLg>{times.length === 1 ? `Reseta will remind ${you(person.name)} at this time. Change it if ${isMe(person.name) ? 'you take' : 'they take'} it at a different time.` : `Reseta will remind ${you(person.name)} at these times. Change any of them to fit ${isMe(person.name) ? 'your' : 'their'} day.`}</BodyLg>
          {times.map((t, i) => (
            <TimePicker key={i} label={times.length > 1 ? `Reminder ${i + 1}` : undefined} value={t} onChange={(v) => setTimes((prev) => prev.map((x, j) => (j === i ? v : x)))} />
          ))}
        </Stack>
      ) : <Notice tone="info">This medicine is taken only when needed, so Reseta sets no reminder. You can note each time you take it.</Notice>}
      {pill ? <Image source={{ uri: pill }} accessibilityLabel="Photo of the medicine" style={{ width: '100%', height: 180, borderRadius: R.sm, resizeMode: 'cover' }} /> : null}
      <Button variant="secondary" size="md" icon="pill" title={pill ? 'Change the medicine photo' : 'Add a photo of the pill or bottle'} onPress={pickPill} />
      <Caption muted>The photo shows on the reminder, so it's easy to pick the right medicine.</Caption>
    </Stack>
  ) : null;

  // ---------- Bottom action bar ----------
  let action: React.ReactNode = null;
  if (step === 1) action = <Button title="Next" disabled={!person} onPress={() => go(2)} />;
  const stillReading = lines.some((l) => l.crop && !l.read);
  if (step === 2) action = <Button title={stillReading ? 'Reading the lines…' : 'Next: check each line'} disabled={!hasText || stillReading} onPress={() => go(3)} />;
  if (step === 3) action = (
    <Stack>
      {problems.length ? <Caption muted>{`${problems.length} thing${problems.length === 1 ? '' : 's'} left to check. ${problems[0]}`}</Caption> : null}
      <Button title="Next: set the times" disabled={problems.length > 0} onPress={() => go(4)} />
    </Stack>
  );
  if (step === 4) action = <Button icon="check" title="Save and set reminders" onPress={save} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: S[4], paddingBottom: S[6], maxWidth: 640, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        {step === 1 ? stepWho : step === 2 ? stepPaper : step === 3 ? stepCheck : stepTimes}
      </ScrollView>
      <View style={{ padding: S[4], paddingTop: S[3], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
        <View style={{ maxWidth: 640, width: '100%', alignSelf: 'center' }}>{action}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Shows the photo and lets the user drag boxes around lines. Coordinates are mapped back to photo pixels. */
function LineMarker({ photo, onBox }: { photo: Photo; onBox: (r: { x: number; y: number; width: number; height: number }) => void }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const h = w ? (w * photo.height) / photo.width : 0;
  const pt = (e: GestureResponderEvent) => ({ x: Math.min(Math.max(e.nativeEvent.locationX, 0), w), y: Math.min(Math.max(e.nativeEvent.locationY, 0), h) });
  const box = drag && { left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {w ? (
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => { const p = pt(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
          onResponderMove={(e) => { const p = pt(e); setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d)); }}
          onResponderRelease={() => {
            if (box && box.width > 12 && box.height > 8) {
              const k = photo.width / w;
              onBox({ x: box.left * k, y: box.top * k, width: box.width * k, height: box.height * k });
            }
            setDrag(null);
          }}
          style={{ width: w, height: h }}
          accessibilityLabel="Photo of the prescription. Drag to mark a line."
        >
          <View style={{ pointerEvents: 'none' }}><Image source={{ uri: photo.uri }} style={{ width: w, height: h, borderRadius: R.sm }} /></View>
          {box ? <View style={{ pointerEvents: 'none', position: 'absolute', borderWidth: 3, borderColor: c.tinta, backgroundColor: 'rgba(255,210,63,0.25)', borderRadius: 6, ...box }} /> : null}
        </View>
      ) : null}
    </View>
  );
}
