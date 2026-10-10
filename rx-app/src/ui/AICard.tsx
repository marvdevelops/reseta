import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { AI_DOWNLOAD_BYTES, AI_NAME, aiInstalled, aiSupported, deleteAI, downloadAI, downloadedSoFar, freeSpaceOk } from '../platform/localAI';
import { pageToolsAvailable } from '../platform/vision';
import { Body, Button, Caption, Card, ConfirmButton, Heading, Notice, R, S, Stack, useColors } from './kit';

const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
const mb = (b: number) => Math.round(b / 1024 ** 2).toLocaleString('en-PH');

/** Turns the on-phone AI reader on (one download) or off. */
export function AICard({ toast }: { toast: (m: string) => void }) {
  const c = useColors();
  const [installed, setInstalled] = useState(aiInstalled());
  const [progress, setProgress] = useState<number | null>(null);
  const [already, setAlready] = useState(downloadedSoFar());
  const abort = useRef<AbortController | null>(null);

  if (!pageToolsAvailable) return null; // web and older test builds
  return (
    <Card>
      <Heading>AI reader</Heading>
      <Body>A second reader for handwriting. It reads each line again, right on this phone, and tells you when it sees something different.</Body>
      {!aiSupported ? (
        <Notice tone="info">This phone does not have enough memory for the AI reader. Reseta still reads the paper with the phone's own text reader.</Notice>
      ) : installed ? (
        <Stack>
          <Notice tone="info" icon="check" title="The AI reader is on">It works without internet. Photos and text never leave this phone.</Notice>
          <ConfirmButton title="Remove the AI reader" question={`Remove the AI reader? This frees ${gb(AI_DOWNLOAD_BYTES)} GB.`} confirmTitle="Yes, remove it"
            onConfirm={async () => { await deleteAI(); setInstalled(false); toast('The AI reader was removed.'); }} />
        </Stack>
      ) : progress !== null ? (
        <Stack>
          <Body>{`Downloading… ${mb(progress)} MB of ${mb(AI_DOWNLOAD_BYTES)} MB`}</Body>
          <View style={{ height: 12, borderRadius: R.pill, backgroundColor: c.tintaSoft, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, (progress / AI_DOWNLOAD_BYTES) * 100)}%`, height: '100%', backgroundColor: c.tinta }} />
          </View>
          <Caption muted>Keep Reseta open; the screen stays on until it finishes. If it stops, tap Continue: it picks up where it left off.</Caption>
          <Button variant="quiet" size="md" title="Stop the download" onPress={() => abort.current?.abort()} />
        </Stack>
      ) : (
        <Stack>
          <Caption muted>{`One download of ${gb(AI_DOWNLOAD_BYTES)} GB (${AI_NAME}). Use Wi-Fi. Only the AI files are downloaded; nothing about you or your medicines is sent.`}</Caption>
          {already > 0 ? <Caption muted>{`${mb(already)} MB already downloaded. It will continue from there.`}</Caption> : null}
          <Button icon="download" title={already > 0 ? 'Continue the download' : 'Turn on the AI reader'} disabled={!freeSpaceOk()} onPress={async () => {
            abort.current = new AbortController();
            setProgress(already);
            try {
              await downloadAI((done) => setProgress(done), abort.current.signal);
              setInstalled(aiInstalled());
              toast('The AI reader is on.');
            } catch (e: any) {
              toast(e?.name === 'AbortError' ? 'Download stopped. It will continue where it left off.' : (e?.message || 'The download did not finish. Check the internet connection and try again.'));
            } finally { setProgress(null); setAlready(downloadedSoFar()); }
          }} />
          {!freeSpaceOk() ? <Caption muted>{`Free up about ${gb(AI_DOWNLOAD_BYTES + 512 * 1024 ** 2)} GB on this phone first.`}</Caption> : null}
        </Stack>
      )}
      <Stack gap={S[1]}><Caption muted>Model: Qwen3-VL 2B by Alibaba Cloud, Apache 2.0 licence.</Caption></Stack>
    </Card>
  );
}
