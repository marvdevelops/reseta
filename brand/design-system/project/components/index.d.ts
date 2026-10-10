/** Reseta components. Load React 18, tokens.css, bundle.css, then bundle.js; components are on window.Reseta. */
export type IconName = 'check' | 'alert' | 'stop' | 'camera' | 'clock' | 'pill' | 'person' | 'speaker' | 'back' | 'plus';
export type ReviewState = 'ok' | 'check' | 'stop';

export interface IconProps { name: IconName; /** px, default 28 (icon-md) */ size?: number; /** default currentColor */ color?: string; }
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one main action on a screen. secondary: other actions. quiet: low-stakes text action. danger: delete. */
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  /** lg = target-primary (68px) high, md = target-min (60px). Default lg. */
  size?: 'lg' | 'md';
  /** Full width. Use for every button inside a step. */
  block?: boolean;
  /** An icon before the word. There are no icon-only buttons. */
  icon?: IconName;
  children: React.ReactNode;
}
export interface StateChipProps { state: ReviewState; /** Override the word. Defaults: Matches / Check this / Ask your pharmacist. */ children?: React.ReactNode; }
export interface FieldCheckProps {
  /** Everyday name of the field: Medicine, Strength, How much, How often, For how long. */
  label: string;
  /** The value read from the paper, already spelled out ("once a day", not "OD"). */
  value: string;
  /** Set numbers in the mono face: strength, how much. */
  mono?: boolean;
  state: ReviewState;
  /** One or two plain sentences: what to compare, or what to do. */
  reason?: string;
  /** URL of the photo crop of the ink behind this value; null shows "Not found on the paper". */
  crop?: string | null;
  confirmed?: boolean;
  onMatch?: () => void;
  onChange?: () => void;
}
export interface ChoiceOption { value: string; label: string; hint?: string; }
export interface ChoiceGroupProps { label?: string; options: ChoiceOption[]; value?: string; onChange?: (value: string) => void; }
export interface StepHeaderProps { step: number; total: number; title: string; onBack?: () => void; }
export interface DoseCardProps {
  /** The person's name as the family says it: "Lola Rosa". */
  person: string;
  /** "8:00 AM" */
  time: string;
  /** Medicine and strength: "Amlodipine 5 mg" */
  medicine: string;
  /** "1 tablet" */
  amount: string;
  /** "after breakfast" */
  instruction?: string;
  /** Photo of the pill or bottle the user took. */
  photo?: string;
  onTaken?: () => void; onSnooze?: () => void; onSkip?: () => void; onSpeak?: () => void;
}
export interface NoticeProps { tone?: 'info' | 'look' | 'stop'; title?: string; children: React.ReactNode; }
