/** Verifica se o stream remoto inclui track de vídeo ativa. */
export function streamHasVideoTrack(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => t.readyState === 'live');
}

/** Verifica se o stream remoto inclui track de áudio (incl. recém-adicionada na renegociação). */
export function streamHasAudioTrack(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.getAudioTracks().some((t) => t.readyState !== 'ended');
}
