import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, View } from 'react-native';
import * as Speech from 'expo-speech';
import { FREQ_WORDS } from '../core/sig';
import { uid, type Card as RxCard, type DoseEvent, type Store } from '../core/model';
import type { DrugList } from '../core/druglist';
import { DRUG_LIST_CHOICES, loadDrugList } from '../drugLists';
import { addToCalendar, cancelCard } from '../platform/alarms';
import { saveText } from '../platform/files';
import {
  Body, BodyBold, BodyLg, Button, Caption, Card, ChoiceGroup, ConfirmButton, Dose, Field, Heading, Icon, Label, LogoMark, Notice, R, S, Stack,
  Time, TimePicker, Title, useColors,
} from './kit';
import { UpdateBanner, VersionCard } from './Updates';
import { AICard } from './AICard';
import { cap, fmtDay, fmtTime, forWhom, isMe, plainDose, takeLine, whose } from './format';

type Upd = (fn: (s: Store) => Store) => void;
const personName = (s: Store, id: string) => s.people.find((p) => p.id === id)?.name ?? 'Someone';
const today = () => new Date().toISOString().slice(0, 10);

/** Whether a card has a dose on the given day (course length and every-other-day respected). */
function activeOn(card: RxCard, day: string) {
  if (card.days) { const end = new Date(card.start); end.setDate(end.getDate() + card.days); if (new Date(day) >= end) return false; }
  if (card.every2 && Math.round((+new Date(day) - +new Date(card.start)) / 864e5) % 2) return false;
  return true;
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ padding: S[4], paddingBottom: S[7], gap: S[5], maxWidth: 640, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>{children}</ScrollView>
  );
}

// ---------- Today ----------
export function TodayScreen({ store, onAdd, onDose }: { store: Store; onAdd: () => void; onDose: (c: RxCard, slot: string) => void }) {
  const c = useColors();
  const day = today();
  const doses = store.cards.filter((card) => activeOn(card, day))
    .flatMap((card) => card.times.map((t) => ({ card, t })))
    .sort((a, b) => a.t.localeCompare(b.t));
  const asNeeded = store.cards.filter((card) => !card.times.length);
  const statusOf = (card: RxCard, t: string) => store.log.find((l) => l.cardId === card.id && l.slot === t && l.at.slice(0, 10) === day)?.status;
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (!store.cards.length) {
    return (
      <Screen>
        <Stack gap={S[2]}><Title a11yHeading>Today</Title><Body muted>{fmtDay(now)}</Body></Stack>
        <UpdateBanner />
        <Card style={{ alignItems: 'flex-start', gap: S[4] }}>
          <LogoMark size={72} />
          <Heading>Add your first medicine</Heading>
          <BodyLg>Take a photo of a prescription. Reseta reads it with you, line by line, and reminds you when it's time.</BodyLg>
          <Button icon="camera" title="Add a medicine" onPress={onAdd} />
        </Card>
        <Caption muted>Everything stays on this phone. Nothing is sent anywhere.</Caption>
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack gap={S[2]}><Title a11yHeading>Today</Title><Body muted>{fmtDay(now)}</Body></Stack>
      <UpdateBanner />
      <Button icon="camera" title="Add a medicine" onPress={onAdd} />
      {doses.length ? doses.map(({ card, t }) => {
        const st = statusOf(card, t);
        const due = !st && t <= hm;
        return (
          <Card key={card.id + t} tone={due ? 'check' : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: S[3] }}>
              <View style={{ flex: 1, gap: S[1] }}>
                <Time color={st ? c.inkMuted : c.tinta}>{fmtTime(t)}</Time>
                <Label muted>{forWhom(personName(store, card.personId))}</Label>
              </View>
              {card.pill ? <Image source={{ uri: card.pill }} accessibilityLabel="Photo of the medicine" style={{ width: 72, height: 72, borderRadius: R.sm }} /> : null}
            </View>
            <Heading>{takeLine(card.dose, card.food)}</Heading>
            <BodyLg>{cap(card.drug)} {card.strength}</BodyLg>
            {st ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[2] }}>
                <Icon name={st === 'taken' ? 'check' : 'clock'} color={st === 'taken' ? c.ok : c.inkMuted} />
                <BodyBold color={st === 'taken' ? c.ok : c.inkMuted}>{st === 'taken' ? 'Taken' : st === 'skipped' ? 'Skipped' : 'Reminder snoozed'}</BodyBold>
              </View>
            ) : <Button variant={due ? 'primary' : 'secondary'} size="md" title={due ? "It's time: open" : 'Open'} onPress={() => onDose(card, t)} />}
          </Card>
        );
      }) : <Notice tone="info">No reminders left for today.</Notice>}
      {asNeeded.length ? (
        <Stack>
          <Heading>Only when needed</Heading>
          {asNeeded.map((card) => (
            <Card key={card.id}>
              <Label muted>{forWhom(personName(store, card.personId))}</Label>
              <Heading>{cap(card.drug)} {card.strength}</Heading>
              <Body>{`${takeLine(card.dose)}, only when needed`}</Body>
              <Button variant="secondary" size="md" title="Log a dose" onPress={() => onDose(card, 'as needed')} />
            </Card>
          ))}
        </Stack>
      ) : null}
    </Screen>
  );
}

// ---------- Medicines ----------
export function MedicinesScreen({ store, update, onAdd, onDose, toast }: { store: Store; update: Upd; onAdd: () => void; onDose: (c: RxCard, slot: string) => void; toast: (m: string) => void }) {
  const c = useColors();
  return (
    <Screen>
      <Title a11yHeading>Medicines</Title>
      <Button icon="camera" title="Add a medicine" onPress={onAdd} />
      {!store.cards.length ? <Notice tone="info">No medicines yet. Add one from a prescription.</Notice> : null}
      {store.people.filter((p) => store.cards.some((card) => card.personId === p.id)).map((p) => (
        <Stack key={p.id}>
          <Heading>{p.name}</Heading>
          {store.cards.filter((card) => card.personId === p.id).map((card) => {
            const dupe = store.cards.some((o) => o !== card && o.personId === card.personId && o.drug === card.drug);
            return (
              <Card key={card.id}>
                <View style={{ flexDirection: 'row', gap: S[4] }}>
                  {card.pill || card.drugCrop ? <Image source={{ uri: (card.pill || card.drugCrop)! }} accessibilityLabel="Photo of the medicine or its handwriting" style={{ width: 80, height: 80, borderRadius: R.sm, resizeMode: 'cover', backgroundColor: '#FFFFFF' }} /> : null}
                  <View style={{ flex: 1, gap: S[1] }}>
                    <Heading>{cap(card.drug)} {card.strength}</Heading>
                    <BodyLg>{`${takeLine(card.dose, card.food)}, ${FREQ_WORDS[card.freq]}.`}</BodyLg>
                  </View>
                </View>
                <Body>{card.days ? `For ${card.days} days, starting ${new Date(card.start).toLocaleDateString('en-PH', { day: 'numeric', month: 'long' })}.` : 'Until you stop it.'}</Body>
                {card.times.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S[2] }}>
                    {card.times.map((t) => (
                      <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: S[1], backgroundColor: c.tintaSoft, borderRadius: R.md, paddingHorizontal: S[3], paddingVertical: S[2] }}>
                        <Icon name="clock" size={22} color={c.tinta} /><BodyBold>{fmtTime(t)}</BodyBold>
                      </View>
                    ))}
                  </View>
                ) : <Body muted>No alarm: taken only when needed.</Body>}
                {dupe ? <Notice tone="look" title="Same medicine twice">{`${isMe(p.name) ? 'You have' : `${p.name} has`} another ${card.drug} reminder. Ask your pharmacist if both are needed.`}</Notice> : null}
                <Button variant="secondary" size="md" icon="pill" title="Show the reminder screen" onPress={() => onDose(card, 'now')} />
                <Button variant="secondary" size="md" icon="calendar" title="Add to phone calendar" disabled={!card.times.length} onPress={async () => {
                  try { toast(await addToCalendar(card, p.name)); } catch (e: any) { toast(e?.message ?? String(e)); }
                }} />
                <ConfirmButton title="Delete this medicine" question={`Delete ${whose(p.name)} ${card.drug} and its reminders?`} confirmTitle="Yes, delete it" onConfirm={async () => {
                  await cancelCard(card);
                  update((s) => ({ ...s, cards: s.cards.filter((x) => x.id !== card.id) }));
                  toast(`Deleted. If you added ${card.drug} to your calendar, delete it there too.`);
                }} />
              </Card>
            );
          })}
        </Stack>
      ))}
    </Screen>
  );
}

// ---------- People ----------
export function PeopleScreen({ store, update, toast }: { store: Store; update: Upd; toast: (m: string) => void }) {
  const [name, setName] = useState('');
  const [wake, setWake] = useState('07:00');
  const [bed, setBed] = useState('21:00');
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Screen>
      <Title a11yHeading>People</Title>
      <BodyLg>Reseta sets new reminders around when each person wakes up and goes to sleep.</BodyLg>
      {store.people.map((p) => {
        const n = store.cards.filter((c) => c.personId === p.id).length;
        return (
          <Card key={p.id}>
            <Heading>{p.name}</Heading>
            {editing === p.id ? (
              <Stack>
                <TimePicker label="Wakes up at" value={p.wake} onChange={(t) => update((s) => ({ ...s, people: s.people.map((x) => (x.id === p.id ? { ...x, wake: t } : x)) }))} />
                <TimePicker label="Goes to sleep at" value={p.bed} onChange={(t) => update((s) => ({ ...s, people: s.people.map((x) => (x.id === p.id ? { ...x, bed: t } : x)) }))} />
                <Caption muted>Reminders you already set keep their times. You can change those when you add a medicine.</Caption>
                <Button size="md" title="Done" onPress={() => setEditing(null)} />
              </Stack>
            ) : (
              <>
                <Body>Wakes up at {fmtTime(p.wake)}, goes to sleep at {fmtTime(p.bed)}</Body>
                <Caption muted>{n ? `${n} medicine${n === 1 ? '' : 's'}` : 'No medicines yet'}</Caption>
                <Button variant="secondary" size="md" icon="clock" title="Change these times" onPress={() => setEditing(p.id)} />
              </>
            )}
          </Card>
        );
      })}
      <Card>
        <Heading>Add a person</Heading>
        <Field label="Name" value={name} onChangeText={setName} placeholder="For example, Lola Rosa" autoCapitalize="words" />
        <TimePicker label="Wakes up at" value={wake} onChange={setWake} />
        <TimePicker label="Goes to sleep at" value={bed} onChange={setBed} />
        <Button icon="plus" title="Add person" disabled={!name.trim()} onPress={() => {
          update((s) => ({ ...s, people: [...s.people, { id: uid(), name: name.trim(), wake, bed }] }));
          toast(`${name.trim()} added.`);
          setName('');
        }} />
      </Card>
    </Screen>
  );
}

// ---------- More ----------
export function MoreScreen({ store, update, toast }: { store: Store; update: Upd; toast: (m: string) => void }) {
  const [list, setList] = useState<DrugList | null>(null);
  useEffect(() => { loadDrugList(store.drugList).then(setList, () => setList(null)); }, [store.drugList]);
  return (
    <Screen>
      <Title a11yHeading>More</Title>
      <Card>
        <ChoiceGroup label="Where are your prescriptions from?" value={store.drugList ?? 'ph-sample'}
          onChange={(v) => update((s) => ({ ...s, drugList: v as Store['drugList'] }))}
          options={DRUG_LIST_CHOICES.map(([id]) => ({ value: id, label: id === 'ph-sample' ? 'The Philippines' : 'The United States', hint: 'Reseta checks medicine names against this country\'s list' }))} />
        {list?.notice ? <Caption muted>{list.notice}</Caption> : null}
      </Card>
      <AICard toast={toast} />
      <VersionCard toast={toast} />
      <HistoryCard store={store} />
      <TestDataCard store={store} update={update} toast={toast} />
      <Card style={{ alignItems: 'flex-start' }}>
        <LogoMark size={56} />
        <Heading>About Reseta</Heading>
        <Body>Reseta reads a prescription with you and reminds you when to take each medicine. It never decides for you: you check every line against the paper.</Body>
        <Body>Reseta does not replace your doctor or pharmacist. When something is unclear, ask them.</Body>
        <Caption muted>Everything stays on this phone. Nothing is sent anywhere.</Caption>
      </Card>
    </Screen>
  );
}

function HistoryCard({ store }: { store: Store }) {
  const c = useColors();
  return (
    <Card>
      <Heading>Dose history</Heading>
      {store.log.length === 0 ? <Body muted>No doses logged yet.</Body> : store.log.slice(0, 30).map((l, i) => {
        const card = store.cards.find((x) => x.id === l.cardId);
        const word = { taken: 'Taken', skipped: 'Skipped', snoozed: 'Snoozed' }[l.status];
        return (
          <View key={i} style={{ flexDirection: 'row', gap: S[3], alignItems: 'flex-start', borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingTop: i ? S[3] : 0 }}>
            <Icon name={l.status === 'taken' ? 'check' : 'clock'} color={l.status === 'taken' ? c.ok : c.inkMuted} />
            <View style={{ flex: 1 }}>
              <BodyBold>{word}: {card ? `${personName(store, card.personId)}, ${card.drug}` : 'a deleted medicine'}</BodyBold>
              <Caption muted>{new Date(l.at).toLocaleString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Caption>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function TestDataCard({ store, update, toast }: { store: Store; update: Upd; toast: (m: string) => void }) {
  const [tester, setTester] = useState(store.consent?.tester ?? '');
  const nLines = store.samples.reduce((a, s) => a + s.lines.length, 0);
  return (
    <Card>
      <Heading>Help us read handwriting better</Heading>
      <Body>If you agree, each prescription you check is kept on this phone as a test sample: the photo of each line, what the phone read, and what you corrected. Nothing is sent. You decide when to share the file.</Body>
      <Body>Only mark medicine lines, never names or addresses. Use prescriptions you have the right to share.</Body>
      <Caption muted>Health information is sensitive under the Philippine Data Privacy Act. Shared files are used only to test reading, and are deleted when you ask.</Caption>
      <Field label="Your tester code" value={tester} onChangeText={setTester} placeholder="For example, DS-01" autoCapitalize="characters" />
      {store.consent ? (
        <>
          <Notice tone="info">{`You agreed on ${new Date(store.consent.at).toLocaleDateString('en-PH')}. ${store.samples.length} sample${store.samples.length === 1 ? '' : 's'} kept, ${nLines} lines.`}</Notice>
          <Button variant="secondary" size="md" title="Share the samples file" disabled={!store.samples.length} onPress={async () => {
            const payload = { format: 'rx-reader-test-samples', version: 1, exportedAt: new Date().toISOString(), consent: store.consent, samples: store.samples };
            const name = `reseta-samples-${(store.consent?.tester || 'tester').replace(/[^\w-]/g, '')}-${today()}.json`;
            try { await saveText(name, JSON.stringify(payload, null, 1), 'application/json'); } catch (e: any) { toast(`Could not share the file: ${e?.message ?? e}`); }
          }} />
          <Button variant="quiet" size="md" title="Stop keeping samples" onPress={() => { update((s) => ({ ...s, consent: null })); toast('Reseta will not keep new samples.'); }} />
          {store.samples.length ? <ConfirmButton title="Delete all samples" question="Delete every test sample on this phone?" confirmTitle="Yes, delete all" onConfirm={() => { update((s) => ({ ...s, samples: [] })); toast('All samples deleted.'); }} /> : null}
        </>
      ) : (
        <Button variant="secondary" size="md" icon="check" title="I agree to keep samples" onPress={() => {
          update((s) => ({ ...s, consent: { at: new Date().toISOString(), tester: tester.trim(), version: 1 } }));
          toast('Thank you. Samples will be kept on this phone.');
        }} />
      )}
    </Card>
  );
}

// ---------- The dose screen, opened by a reminder ----------
export function DoseModal({ store, dose, onClose }: { store: Store; dose: { card: RxCard; slot: string } | null; onClose: (status: DoseEvent['status']) => void }) {
  const c = useColors();
  if (!dose) return null;
  const { card, slot } = dose;
  const who = personName(store, card.personId);
  const time = /^\d\d:\d\d$/.test(slot) ? fmtTime(slot) : null;
  const say = () => {
    Speech.stop();
    Speech.speak(`Time for ${whose(who)} medicine. ${takeLine(card.dose, card.food)}. ${card.drug}, ${card.strength}.`);
  };
  return (
    <Modal visible animationType="slide" onRequestClose={() => onClose('snoozed')}>
      <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={{ padding: S[5], paddingTop: Platform.OS === 'ios' ? 64 : S[5], gap: S[4], maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <Label muted>{time ? `It's ${time}` : 'Your medicine'}</Label>
        <Title a11yHeading>Time for {whose(who)} medicine</Title>
        <Card>
          <Dose>{takeLine(card.dose, card.food)}</Dose>
          <BodyLg>{cap(card.drug)} {card.strength}</BodyLg>
          {card.pill ? <Image source={{ uri: card.pill }} accessibilityLabel="Photo of the medicine" style={{ width: '100%', height: 200, resizeMode: 'contain', borderRadius: R.sm }} /> : null}
          {card.drugCrop ? (
            <Stack gap={S[2]}>
              <Caption muted>From the prescription:</Caption>
              <Image source={{ uri: card.drugCrop }} accessibilityLabel="The handwriting of the medicine name" style={{ width: '100%', height: 80, resizeMode: 'contain', backgroundColor: '#FFFFFF', borderRadius: R.sm }} />
            </Stack>
          ) : null}
        </Card>
        <Button icon="check" title="I took it" onPress={() => onClose('taken')} />
        <Button variant="secondary" icon="clock" title="Remind me in 10 minutes" onPress={() => onClose('snoozed')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: S[2] }}>
          <Button variant="quiet" size="md" block={false} title="Skip this dose" onPress={() => onClose('skipped')} />
          <Button variant="quiet" size="md" block={false} icon="speaker" title="Read aloud" onPress={say} />
        </View>
      </ScrollView>
    </Modal>
  );
}
