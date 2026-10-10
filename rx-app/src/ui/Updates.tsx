// Over-the-air updates (EAS Update): Reseta checks for a new version when it opens and when it comes back
// to the screen, and offers one button to install it. Nothing about the user's medicines is sent: the check
// only asks Expo's update server whether a newer app bundle exists for this build.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type * as UpdatesModule from 'expo-updates';

// Builds made before expo-updates was added (and the web) lack its native module; importing it there would crash.
const Updates: typeof UpdatesModule | null = requireOptionalNativeModule('ExpoUpdates') ? require('expo-updates') : null;
const enabled = !!Updates?.isEnabled;
import { Body, Button, Caption, Card, Heading, Notice, Stack } from './kit';

const CHECK_EVERY_MS = 30 * 60 * 1000;

/** Checks on launch and on return to the app, at most every 30 minutes. */
export function useUpdateCheck() {
  const last = useRef(0);
  const check = useCallback(async (force = false) => {
    if (!Updates || !enabled || (!force && Date.now() - last.current < CHECK_EVERY_MS)) return null;
    last.current = Date.now();
    try { return await Updates.checkForUpdateAsync(); } catch { return null; }
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);
  return check;
}

async function installNow() {
  const r = await Updates!.fetchUpdateAsync();
  if (r.isNew || r.isRollBackToEmbedded) await Updates!.reloadAsync();
}

/** The banner on Today. Shows only when a newer version is waiting. */
export function UpdateBanner() {
  return Updates && enabled ? <Banner /> : null;
}

function Banner() {
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates!.useUpdates();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!isUpdateAvailable && !isUpdatePending) return null;
  const working = busy || isDownloading;
  return (
    <Notice tone="look" icon="download" title="A new version of Reseta is ready">
      <Stack>
        <Body color="#14213D">It takes a few seconds. Your medicines and reminders stay as they are.</Body>
        {failed ? <Body color="#14213D">The update could not download. Check the internet connection and try again.</Body> : null}
        <Button title={working ? 'Updating…' : 'Update now'} disabled={working} onPress={async () => {
          setBusy(true); setFailed(false);
          try { isUpdatePending ? await Updates!.reloadAsync() : await installNow(); } catch { setFailed(true); } finally { setBusy(false); }
        }} />
      </Stack>
    </Notice>
  );
}

/** The card under More: which version is installed, and a button to look for a newer one. */
export function VersionCard({ toast }: { toast: (m: string) => void }) {
  if (!Updates || !enabled) {
    return <Card><Heading>App version</Heading><Body>Updates are off in this test build.</Body></Card>;
  }
  return <VersionDetails toast={toast} />;
}

function VersionDetails({ toast }: { toast: (m: string) => void }) {
  const U = Updates!;
  const { isUpdateAvailable, isUpdatePending } = U.useUpdates();
  const [checking, setChecking] = useState(false);
  const built = U.createdAt ? U.createdAt.toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <Card>
      <Heading>App version</Heading>
      <Body>{U.isEmbeddedLaunch ? 'The version that came with this install.' : `Updated${built ? ` on ${built}` : ''}.`}</Body>
      {isUpdateAvailable || isUpdatePending ? <UpdateBanner /> : (
          <Button variant="secondary" size="md" title={checking ? 'Checking…' : 'Check for updates'} disabled={checking} onPress={async () => {
            setChecking(true);
            try {
              const r = await U.checkForUpdateAsync();
              if (!r.isAvailable) toast('Reseta is up to date.');
            } catch { toast('Reseta could not check for updates. Check the internet connection.'); }
            finally { setChecking(false); }
          }} />
      )}
      {U.updateId ? <Caption muted>{`Version ${U.updateId.slice(0, 8)}`}</Caption> : null}
    </Card>
  );
}
