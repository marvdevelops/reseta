import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import type { Card, DoseEvent, Store } from './src/core/model';
import { toHM } from './src/core/sig';
import { loadStore, saveStore } from './src/storage';
import { scheduleCard } from './src/platform/alarms';
import AddFlow from './src/ui/AddFlow';
import { DoseModal, MedicinesScreen, MoreScreen, PeopleScreen, TodayScreen } from './src/ui/Screens';
import { COMPACT, Icon, S, T, TARGET, useColors, useIsDark, type IconName } from './src/ui/kit';
import { fmtTime, isMe, you } from './src/ui/format';
import { useUpdateCheck } from './src/ui/Updates';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Tab = 'today' | 'medicines' | 'people' | 'more';
const TABS: [Tab, string, IconName][] = [['today', 'Today', 'home'], ['medicines', 'Medicines', 'list'], ['people', 'People', 'person'], ['more', 'More', 'more']];

export default function App() {
  return <SafeAreaProvider><Main /></SafeAreaProvider>;
}

function Main() {
  const c = useColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ 'ResetaLexend-400': require('./assets/fonts/ResetaLexend-400-v2.ttf'), 'ResetaLexend-700': require('./assets/fonts/ResetaLexend-700-v2.ttf') });
  const [store, setStore] = useState<Store | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [adding, setAdding] = useState(false);
  const [dose, setDose] = useState<{ card: Card; slot: string } | null>(null);
  const [msg, setMsg] = useState('');
  useUpdateCheck();
  const fired = useRef(new Set<string>());
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadStore().then(setStore); }, []);
  useEffect(() => { if (fontsLoaded && store) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded, store]);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(''), 6000);
  }, []);

  const update = useCallback((fn: (s: Store) => Store) => {
    setStore((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveStore(next).then((ok) => { if (!ok) toast('Reseta could not save on this phone. The phone may be full.'); });
      return next;
    });
  }, [toast]);

  // Tapping a dose notification opens the dose screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const { cardId, slot } = (r.notification.request.content.data ?? {}) as { cardId?: string; slot?: string };
      setStore((s) => { const card = s?.cards.find((x) => x.id === cardId); if (card) setDose({ card, slot: slot ?? 'now' }); return s; });
    });
    return () => sub.remove();
  }, []);

  // While the app is open, show the dose screen at each dose time (the web build's only alarm).
  useEffect(() => {
    const tick = () => {
      if (!store || dose) return;
      const now = new Date(), hm = toHM(now.getHours() * 60 + now.getMinutes()), day = now.toISOString().slice(0, 10);
      for (const card of store.cards) {
        if (card.days) { const end = new Date(card.start); end.setDate(end.getDate() + card.days); if (now >= end) continue; }
        if (card.every2 && Math.round((+new Date(day) - +new Date(card.start)) / 864e5) % 2) continue;
        for (const t of card.times) {
          const k = `${card.id}|${day}|${t}`;
          if (t === hm && !fired.current.has(k)) { fired.current.add(k); setDose({ card, slot: t }); return; }
        }
      }
    };
    const h = setInterval(tick, 15000);
    tick();
    return () => clearInterval(h);
  }, [store, dose]);

  async function onSaved(card: Card) {
    setAdding(false);
    setTab('today');
    const who = store?.people.find((p) => p.id === card.personId)?.name ?? '';
    try {
      const ids = await scheduleCard(card, who);
      if (ids.length) update((s) => ({ ...s, cards: s.cards.map((x) => (x.id === card.id ? { ...x, scheduledIds: ids } : x)) }));
      toast(card.times.length ? `Saved. Reseta will remind ${you(who)} at ${card.times.map(fmtTime).join(', ')}.` : `Saved ${card.drug} for ${isMe(who) ? 'you' : who}.`);
    } catch (e: any) { toast(`Saved, but the reminders could not be set: ${e?.message ?? e}`); }
  }

  function closeDose(status: DoseEvent['status']) {
    if (!dose) return;
    const ev: DoseEvent = { at: new Date().toISOString(), cardId: dose.card.id, slot: dose.slot, status };
    update((s) => ({ ...s, log: [ev, ...s.log] }));
    const { card, slot } = dose;
    setDose(null);
    if (status === 'snoozed') { toast('Reseta will remind you again in 10 minutes.'); setTimeout(() => setDose({ card, slot }), 10 * 60 * 1000); }
    if (status === 'taken') toast('Marked as taken.');
  }

  if (!fontsLoaded || !store) return <View style={{ flex: 1, backgroundColor: c.paper }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>
        {adding ? (
          <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: c.paper }}>
            <AddFlow store={store} update={update} onSaved={onSaved} onCancel={() => setAdding(false)} toast={toast} />
          </View>
        ) : (
          <>
            {tab === 'today' && <TodayScreen store={store} onAdd={() => setAdding(true)} onDose={(card, slot) => setDose({ card, slot })} />}
            {tab === 'medicines' && <MedicinesScreen store={store} update={update} onAdd={() => setAdding(true)} onDose={(card, slot) => setDose({ card, slot })} toast={toast} />}
            {tab === 'people' && <PeopleScreen store={store} update={update} toast={toast} />}
            {tab === 'more' && <MoreScreen store={store} update={update} toast={toast} />}
          </>
        )}
      </View>
      {!adding ? (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: insets.bottom, paddingHorizontal: S[2] }}>
          {TABS.map(([k, label, icon]) => {
            const on = tab === k;
            return (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => setTab(k)}
                style={{ flex: 1, minHeight: TARGET.primary + 8, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: S[2], paddingHorizontal: 2 }}>
                <View style={{ backgroundColor: on ? c.tintaSoft : 'transparent', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 }}>
                  <Icon name={icon} color={on ? c.tinta : c.inkMuted} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                  style={[T.label, { color: on ? c.tinta : c.inkMuted, fontSize: COMPACT ? 15 : 17, textAlign: 'center', alignSelf: 'stretch' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {msg ? (
        <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: S[4], right: S[4], bottom: insets.bottom + (adding ? 110 : 96), backgroundColor: c.ink, borderRadius: 16, padding: S[4] }}>
          <Text style={[T.body, { color: c.paper }]}>{msg}</Text>
        </View>
      ) : null}
      <DoseModal store={store} dose={dose} onClose={closeDose} />
    </View>
  );
}
