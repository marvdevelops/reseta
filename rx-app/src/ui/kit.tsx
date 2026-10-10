// Reseta's UI kit: the design system's tokens and components for React Native.
// Source of truth: brand/design-system/project/tokens.json and its README.
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, Text, TextInput, useColorScheme, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { State } from '../core/draft';

const light = {
  paper: '#F3F5FA', surface: '#FFFFFF', surfaceSunk: '#E8ECF5', ink: '#14213D', inkMuted: '#47526B', line: '#DCE1EC', lineStrong: '#6B7590',
  tinta: '#2340B0', tintaPress: '#1A2F85', tintaSoft: '#E4E9FB', onTinta: '#FFFFFF', highlighter: '#FFD23F', onHighlighter: '#14213D',
  ok: '#0B6B74', okSoft: '#DDF1F2', check: '#7A4E00', checkSoft: '#FFF2CC', stop: '#B42318', stopSoft: '#FDE6E3', focus: '#2340B0',
};
const dark: typeof light = {
  paper: '#0D1322', surface: '#161F35', surfaceSunk: '#0A0F1C', ink: '#EEF1F8', inkMuted: '#B6BED2', line: '#2A3552', lineStrong: '#8A94AE',
  tinta: '#9AAEFF', tintaPress: '#B8C6FF', tintaSoft: '#24325C', onTinta: '#0D1322', highlighter: '#FFD23F', onHighlighter: '#14213D',
  ok: '#5FD0D8', okSoft: '#103A40', check: '#FFC94D', checkSoft: '#3A2E10', stop: '#FF8A7A', stopSoft: '#46191A', focus: '#FFD23F',
};
export type Colors = typeof light;
export const useColors = (): Colors => (useColorScheme() === 'dark' ? dark : light);
export const useIsDark = () => useColorScheme() === 'dark';

// Lexend: built for easy reading, with plain zeros (no slashed 0) so times and amounts look everyday, not technical.
export const FONTS = {
  regular: 'ResetaLexend-400',
  bold: 'ResetaLexend-700',
  mono: 'ResetaLexend-400',
  monoBold: 'ResetaLexend-700',
};
// Small phones (iPhone SE, 375 points wide) get the same layout about 10% smaller; 402+ points is full size.
const SHORT = Math.min(Dimensions.get('window').width, Dimensions.get('window').height);
export const SCALE = Math.max(0.86, Math.min(1, SHORT / 402));
export const COMPACT = SCALE < 0.97;
const sz = (n: number) => Math.round(n * SCALE);

/** The type scale. Nothing a user must read is below `caption`. */
const BASE_T = {
  title: { fontFamily: FONTS.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  heading: { fontFamily: FONTS.bold, fontSize: 26, lineHeight: 32 },
  bodyLg: { fontFamily: FONTS.regular, fontSize: 22, lineHeight: 30 },
  body: { fontFamily: FONTS.regular, fontSize: 20, lineHeight: 28 },
  bodyBold: { fontFamily: FONTS.bold, fontSize: 20, lineHeight: 28 },
  label: { fontFamily: FONTS.bold, fontSize: 18, lineHeight: 24 },
  caption: { fontFamily: FONTS.regular, fontSize: 17, lineHeight: 24 },
  button: { fontFamily: FONTS.bold, fontSize: 22, lineHeight: 26 },
  dose: { fontFamily: FONTS.bold, fontSize: 28, lineHeight: 34 },
  time: { fontFamily: FONTS.bold, fontSize: 44, lineHeight: 50 },
} satisfies Record<string, TextStyle>;
export const T = Object.fromEntries(Object.entries(BASE_T).map(([k, v]) => [k, {
  ...v, fontSize: sz(v.fontSize), lineHeight: sz(v.lineHeight),
  // Keep body text at 17 or more even on the smallest phone.
  ...(v.fontSize >= 17 && sz(v.fontSize) < 17 ? { fontSize: 17, lineHeight: Math.max(sz(v.lineHeight), 23) } : null),
}])) as typeof BASE_T;
export const S = { 1: 4, 2: 8, 3: 12, 4: 16, 5: COMPACT ? 18 : 24, 6: COMPACT ? 26 : 32, 7: COMPACT ? 40 : 48 } as const;
export const R = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const TARGET = { min: COMPACT ? 56 : 60, primary: COMPACT ? 62 : 68 } as const;

// ---------- Icons: the logo's stroke, 24 grid, 2.25 stroke, round caps and joins ----------
export type IconName = 'check' | 'alert' | 'stop' | 'camera' | 'clock' | 'pill' | 'person' | 'speaker' | 'back' | 'plus' | 'list' | 'home' | 'more' | 'image' | 'type' | 'trash' | 'calendar' | 'download';
export function Icon({ name, size = 28, color }: { name: IconName; size?: number; color: string }) {
  const p = { stroke: color, strokeWidth: 2.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const parts: Record<IconName, React.ReactNode> = {
    check: <Path d="M5 12.5l5 5L19 7" {...p} />,
    alert: <><Circle cx={12} cy={12} r={9} {...p} /><Path d="M12 7.5V13" {...p} /><Circle cx={12} cy={16.6} r={1.1} fill={color} /></>,
    stop: <><Path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" {...p} /><Path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" {...p} /></>,
    camera: <><Rect x={3} y={7} width={18} height={13} rx={3} {...p} /><Path d="M8.5 7L10 4.5h4L15.5 7" {...p} /><Circle cx={12} cy={13.5} r={3.5} {...p} /></>,
    clock: <><Circle cx={12} cy={12} r={9} {...p} /><Path d="M12 7v5l3.5 2" {...p} /></>,
    pill: <><Rect x={3.5} y={8.5} width={17} height={7} rx={3.5} transform="rotate(-45 12 12)" {...p} /><Path d="M9.5 9.5l5 5" {...p} /></>,
    person: <><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" {...p} /></>,
    speaker: <><Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...p} /><Path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" {...p} /></>,
    back: <Path d="M14.5 5.5L8 12l6.5 6.5" {...p} />,
    plus: <Path d="M12 5v14M5 12h14" {...p} />,
    list: <><Rect x={4} y={3.5} width={16} height={17} rx={3} {...p} /><Path d="M8 9h8M8 13h8M8 17h5" {...p} /></>,
    home: <><Path d="M4 11l8-6.5 8 6.5" {...p} /><Path d="M6 9.5V20h12V9.5" {...p} /><Path d="M10 20v-5h4v5" {...p} /></>,
    more: <><Circle cx={6} cy={12} r={1.4} fill={color} /><Circle cx={12} cy={12} r={1.4} fill={color} /><Circle cx={18} cy={12} r={1.4} fill={color} /></>,
    image: <><Rect x={3} y={4.5} width={18} height={15} rx={3} {...p} /><Circle cx={9} cy={10} r={1.8} {...p} /><Path d="M4 18l5.5-5 4 3.5 2.5-2 4 3.5" {...p} /></>,
    type: <><Rect x={2.5} y={6} width={19} height={12} rx={3} {...p} /><Path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9" {...p} /></>,
    trash: <><Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" {...p} /></>,
    calendar: <><Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...p} /><Path d="M3.5 10h17M8 3v4M16 3v4" {...p} /></>,
    download: <Path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" {...p} />,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{parts[name]}</Svg>;
}

/** The logo mark: an R whose leg is a check mark, on its tinta tile. */
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width={100} height={100} rx={24} fill="#2340B0" />
      <Path d="M32 24 V76 M32 24 H50 a14 14 0 0 1 0 28 H32" stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(50 50) scale(0.8) translate(-60 -50)" />
      <Path d="M45 52 L58 76 L87 37" stroke="#FFD23F" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(50 50) scale(0.8) translate(-60 -50)" />
    </Svg>
  );
}

// ---------- Text ----------
type TxtProps = { children: React.ReactNode; style?: TextStyle | TextStyle[]; muted?: boolean; color?: string; center?: boolean; a11yHeading?: boolean };
function makeText(variant: keyof typeof T) {
  return function Txt({ children, style, muted, color, center, a11yHeading }: TxtProps) {
    const c = useColors();
    return <Text accessibilityRole={a11yHeading ? 'header' : undefined}
      style={[T[variant], { color: color ?? (muted ? c.inkMuted : c.ink) }, center ? { textAlign: 'center' } : null, style as TextStyle]}>{children}</Text>;
  };
}
export const Title = makeText('title');
export const Heading = makeText('heading');
export const BodyLg = makeText('bodyLg');
export const Body = makeText('body');
export const BodyBold = makeText('bodyBold');
export const Label = makeText('label');
export const Caption = makeText('caption');
export const Dose = makeText('dose');
export const Time = makeText('time');

// ---------- Layout ----------
export function Card({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: 'check' | 'stop' }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: R.lg, padding: S[5], gap: S[3],
      shadowColor: '#14213D', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
      tone ? { borderWidth: 2, borderColor: tone === 'stop' ? c.stop : c.check } : null, style]}>{children}</View>
  );
}
export function Stack({ children, gap = S[3], style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

// ---------- Button ----------
export type BtnVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export function Button({ title, onPress, variant = 'primary', size = 'lg', icon, disabled, block = true, a11yHint }: {
  title: string; onPress: () => void; variant?: BtnVariant; size?: 'lg' | 'md'; icon?: IconName; disabled?: boolean; block?: boolean; a11yHint?: string;
}) {
  const c = useColors();
  const fg = disabled ? c.inkMuted : variant === 'primary' ? c.onTinta : variant === 'danger' ? c.stop : c.tinta;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} accessibilityHint={a11yHint} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [{
        minHeight: size === 'lg' ? TARGET.primary : TARGET.min, minWidth: TARGET.min, borderRadius: R.md, paddingHorizontal: variant === 'quiet' ? S[3] : S[5],
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S[2], borderWidth: 2, alignSelf: block ? 'stretch' : 'flex-start',
        borderColor: 'transparent', backgroundColor: 'transparent',
      },
      variant === 'primary' && { backgroundColor: pressed ? c.tintaPress : c.tinta },
      variant === 'secondary' && { backgroundColor: pressed ? c.tintaSoft : c.surface, borderColor: c.lineStrong },
      variant === 'danger' && { backgroundColor: pressed ? c.stopSoft : c.surface, borderColor: c.stop },
      variant === 'quiet' && pressed && { backgroundColor: c.tintaSoft },
      disabled && { backgroundColor: c.surfaceSunk, borderColor: c.line }]}>
      {icon ? <Icon name={icon} color={fg} /> : null}
      <Text style={[T.button, { color: fg, textAlign: 'center', flexShrink: 1 }, variant === 'quiet' && !disabled ? { textDecorationLine: 'underline' } : null]}>{title}</Text>
    </Pressable>
  );
}

/** Destructive action that asks once, in words, before it acts. */
export function ConfirmButton({ title, question, confirmTitle, onConfirm }: { title: string; question: string; confirmTitle: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button variant="danger" size="md" icon="trash" title={title} onPress={() => setAsking(true)} />;
  return (
    <Notice tone="stop" title={question}>
      <Stack>
        <Button variant="danger" size="md" title={confirmTitle} onPress={() => { setAsking(false); onConfirm(); }} />
        <Button variant="quiet" size="md" title="No, keep it" onPress={() => setAsking(false)} />
      </Stack>
    </Notice>
  );
}

/** Two-tap choice for look-alike names: the first tap asks, the second confirms. */
export function TwoTapChoice({ title, armed, onConfirm }: { title: string; armed: string; onConfirm: () => void }) {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return <Button variant={on ? 'primary' : 'secondary'} title={on ? armed : title} onPress={() => {
    if (on) { setOn(false); onConfirm(); return; }
    setOn(true); t.current = setTimeout(() => setOn(false), 8000);
  }} />;
}

// ---------- State ----------
export type ChipState = 'ok' | 'check' | 'stop';
export const chipOf = (s: State, confirmed?: boolean): ChipState => (confirmed ? 'ok' : s === 'g' ? 'ok' : s === 'a' ? 'check' : 'stop');
export function StateChip({ state, label }: { state: ChipState; label?: string }) {
  const c = useColors();
  const fg = { ok: c.ok, check: c.check, stop: c.stop }[state];
  const bg = { ok: c.okSoft, check: c.checkSoft, stop: c.stopSoft }[state];
  const icon: IconName = { ok: 'check', check: 'alert', stop: 'stop' }[state] as IconName;
  const word = label ?? { ok: 'Looks right', check: 'Check this', stop: 'Ask your pharmacist' }[state];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[1], backgroundColor: bg, borderRadius: R.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 14, alignSelf: 'flex-start' }}>
      <Icon name={icon} size={22} color={fg} />
      <Text style={[T.label, { color: fg }]}>{word}</Text>
    </View>
  );
}

export function Notice({ tone = 'info', title, children, icon }: { tone?: 'info' | 'look' | 'stop'; title?: string; children?: React.ReactNode; icon?: IconName }) {
  const c = useColors();
  const bg = { info: c.tintaSoft, look: c.highlighter, stop: c.stopSoft }[tone];
  const fg = tone === 'look' ? c.onHighlighter : c.ink;
  return (
    <View accessibilityRole={tone === 'stop' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: S[3], padding: S[4], borderRadius: R.md, backgroundColor: bg }}>
      <Icon name={icon ?? (tone === 'stop' ? 'stop' : 'alert')} color={tone === 'stop' ? c.stop : fg} />
      <View style={{ flex: 1, gap: S[2] }}>
        {title ? <Text style={[T.bodyBold, { color: fg }]}>{title}</Text> : null}
        {typeof children === 'string' ? <Text style={[T.body, { color: fg }]}>{children}</Text> : children}
      </View>
    </View>
  );
}

// ---------- Inputs ----------
export function Field(props: TextInputProps & { label?: string; mono?: boolean }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: S[2] }}>
      {props.label ? <Text style={[T.label, { color: c.ink }]}>{props.label}</Text> : null}
      {/* Autocorrect off: iOS turns "Amlodipine" into "Amloid pine", silently changing what the user typed. */}
      <TextInput placeholderTextColor={c.inkMuted} autoCorrect={false} spellCheck={false} autoComplete="off" {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }} onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[props.mono ? T.dose : T.body, { minHeight: TARGET.min, borderWidth: 2, borderColor: focus ? c.focus : c.lineStrong, borderRadius: R.sm,
          paddingHorizontal: S[4], paddingVertical: S[3], color: c.ink, backgroundColor: c.surface }, props.style as TextStyle]} />
    </View>
  );
}

export type Choice = { value: string; label: string; hint?: string };
export function ChoiceGroup({ label, options, value, onChange }: { label?: string; options: Choice[]; value?: string; onChange: (v: string) => void }) {
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: S[3] }}>
      {label ? <Text style={[T.bodyLg, { color: c.ink, fontFamily: FONTS.bold }]}>{label}</Text> : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: S[3], minHeight: TARGET.min, paddingVertical: S[3], paddingHorizontal: S[4],
              borderRadius: R.md, borderWidth: 2, borderColor: on ? c.tinta : c.lineStrong, backgroundColor: on || pressed ? c.tintaSoft : c.surface })}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: on ? c.tinta : c.lineStrong, backgroundColor: on ? c.tinta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Icon name="check" size={20} color={c.onTinta} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.button, { color: c.ink, lineHeight: 28 }]}>{o.label}</Text>
              {o.hint ? <Text style={[T.label, { color: c.inkMuted, fontFamily: FONTS.regular }]}>{o.hint}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Flow ----------
export function StepHeader({ step, total, title, onBack, backTitle = 'Back' }: { step: number; total: number; title: string; onBack?: () => void; backTitle?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: S[2], paddingBottom: S[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S[3] }}>
        {onBack ? <Button variant="quiet" size="md" icon="back" title={backTitle} block={false} onPress={onBack} /> : <View style={{ height: TARGET.min }} />}
        <View style={{ backgroundColor: c.tintaSoft, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 4 }}>
          <Text style={[T.label, { color: c.ink }]}>Step {step} of {total}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step ? c.tinta : c.line }} />)}
      </View>
      <Title a11yHeading style={{ marginTop: S[2] }}>{title}</Title>
    </View>
  );
}

/** One line of the prescription to confirm: the ink, the value, why it might be wrong, and two clear choices. */
export function FieldCheck({ label, value, mono, state, reason, crop, confirmed, onMatch, onChange, children, matchDisabled }: {
  label: string; value: string; mono?: boolean; state: State; reason: string; crop: string | null; confirmed?: boolean;
  onMatch: () => void; onChange: () => void; children?: React.ReactNode; matchDisabled?: boolean;
}) {
  const c = useColors();
  const chip = chipOf(state, confirmed);
  return (
    <Card tone={confirmed ? undefined : state === 'r' ? 'stop' : state === 'a' ? 'check' : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: S[2] }}>
        <Label muted>{label}</Label>
        <StateChip state={chip} label={confirmed ? 'Matches' : undefined} />
      </View>
      {crop ? (
        <View style={{ backgroundColor: c.surfaceSunk, borderRadius: R.sm, minHeight: 72, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Image source={{ uri: crop }} accessibilityLabel={`The handwriting for ${label}`} style={{ width: '100%', height: 88, resizeMode: 'contain', backgroundColor: '#FFFFFF' }} />
        </View>
      ) : <Caption muted>{value ? 'From the line you typed.' : 'Not found on the paper.'}</Caption>}
      <Text style={[mono ? T.dose : T.heading, { color: c.ink }]}>{value || '—'}</Text>
      {reason ? <Body>{reason}</Body> : null}
      {children}
      {confirmed ? (
        <Stack>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[2], backgroundColor: c.okSoft, borderRadius: R.md, paddingVertical: S[3], paddingHorizontal: S[4] }}>
            <Icon name="check" color={c.ok} /><Text style={[T.bodyBold, { color: c.ok }]}>You checked this</Text>
          </View>
          <Button variant="quiet" size="md" title="Change" onPress={onChange} />
        </Stack>
      ) : (
        <Stack>
          {state === 'r'
            ? <Button variant="secondary" icon="type" title="Type it from the label" onPress={onChange} />
            : <Button variant="secondary" icon="check" title="Matches the paper" onPress={onMatch} disabled={matchDisabled} />}
          {state === 'r' ? null : <Button variant="quiet" size="md" title="It's different, change it" onPress={onChange} />}
        </Stack>
      )}
    </Card>
  );
}

/** Picks a time with two big buttons, in half-hour steps. No typing and no 24-hour clock. */
export function TimePicker({ label, value, onChange, compact }: { label?: string; value: string; onChange: (hm: string) => void; compact?: boolean }) {
  const c = useColors();
  const step = (d: number) => {
    const [h, m] = value.split(':').map(Number);
    const t = (((h * 60 + m + d) % 1440) + 1440) % 1440;
    onChange(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  };
  const [h, m] = value.split(':').map(Number);
  const shown = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return (
    <View style={{ gap: S[2] }}>
      {label ? <Text style={[T.label, { color: c.ink }]}>{label}</Text> : null}
      <View style={{ backgroundColor: c.tintaSoft, borderRadius: R.md, padding: S[3], gap: S[3] }}>
        <Text accessibilityLiveRegion="polite" style={[compact ? T.dose : T.time, { color: c.ink, textAlign: 'center' }]}>{shown}</Text>
        <View style={{ flexDirection: 'row', gap: S[3] }}>
          <View style={{ flex: 1 }}><Button variant="secondary" size="md" title="Earlier" onPress={() => step(-30)} a11yHint="Half an hour earlier" /></View>
          <View style={{ flex: 1 }}><Button variant="secondary" size="md" title="Later" onPress={() => step(30)} a11yHint="Half an hour later" /></View>
        </View>
      </View>
    </View>
  );
}
