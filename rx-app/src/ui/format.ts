/** "08:00" → "8:00 AM". Philippine phones and people read the 12-hour clock. */
export function fmtTime(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hm;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Friday, 9 October" */
export function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** The person as a sentence says them: the default profile "Me" reads as "you". */
export const isMe = (name: string) => name.trim().toLowerCase() === 'me';
export const you = (name: string) => (isMe(name) ? 'you' : name);
export const whose = (name: string) => (isMe(name) ? 'your' : `${name}'s`);
export const forWhom = (name: string) => (isMe(name) ? 'For you' : `For ${name}`);

/** Generic names are stored lowercase; show them with a capital, as on a label. */
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const UNITS: [RegExp, string, string][] = [
  [/^(tab|tabs|tablet|tablets|tb)$/i, 'tablet', 'tablets'], [/^(cap|caps|capsule|capsules)$/i, 'capsule', 'capsules'],
  [/^(tsp|teaspoon|teaspoons)$/i, 'teaspoon', 'teaspoons'], [/^(tbsp|tablespoon|tablespoons)$/i, 'tablespoon', 'tablespoons'],
  [/^(puff|puffs)$/i, 'puff', 'puffs'], [/^(drop|drops|gtt|gtts)$/i, 'drop', 'drops'], [/^(sachet|sachets)$/i, 'sachet', 'sachets'],
  [/^(ml|cc)$/i, 'mL', 'mL'],
];
/** "1 tab" → "1 tablet", "2 caps" → "2 capsules", "½ tab" → "half a tablet". */
export function plainDose(dose: string): string {
  const m = dose.trim().match(/^(\d+(?:\.\d+)?|½|1\/2)\s*([a-z]+)?\s*(.*)$/i);
  if (!m) return dose;
  const [, n, unit = '', rest] = m;
  const u = UNITS.find(([re]) => re.test(unit));
  const half = n === '½' || n === '1/2' || n === '0.5';
  const word = u ? (half || Number(n) <= 1 ? u[1] : u[2]) : unit;
  const lead = half ? (u ? `half a ${word}` : `half ${word}`) : `${n} ${word}`;
  return `${lead}${rest ? ` ${rest}` : ''}`.trim();
}
/** "Take 1 tablet, after meals" */
export const takeLine = (dose: string, food?: string) => `Take ${plainDose(dose)}${food ? `, ${food}` : ''}`;
