import { useEffect, useRef } from 'react';
import { VideoPreview } from '@/domains/intercom/components/VideoPreview';
import {
  streamHasAudioTrack,
  streamHasVideoTrack,
} from '@/domains/intercom/lib/media-stream-utils';

type Props = {
  stream: MediaStream | null;
};

/**
 * Reproduz mídia remota do morador no navegador do visitante.
 * O morador envia só áudio — o stream precisa estar em <audio> ou <video>.
 */
export function RemoteResidentPlayback({ stream }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = streamHasVideoTrack(stream);
  const hasAudio = streamHasAudioTrack(stream);

  useEffect(() => {
    if (hasVideo) return;
    const el = audioRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream, hasVideo]);

  if (!stream || (!hasVideo && !hasAudio)) {
    return null;
  }

  if (hasVideo) {
    return <VideoPreview stream={stream} label="Morador" />;
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-ds-sm text-ds-dim">
        Morador na linha (áudio)
      </p>
      <audio ref={audioRef} autoPlay playsInline className="sr-only" />
    </div>
  );
}
