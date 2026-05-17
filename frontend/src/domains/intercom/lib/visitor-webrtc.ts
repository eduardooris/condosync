import type { IceServerConfig, IntercomSignalMessage } from '@/shared/types/intercom';

export type SignalOut = (msg: Pick<IntercomSignalMessage, 'type' | 'sdp' | 'candidate'>) => void;

function toRtcIceServers(servers: IceServerConfig[]): RTCIceServer[] {
  return servers.map((s) => ({
    urls: s.urls,
    username: s.username,
    credential: s.credential,
  }));
}

export class VisitorWebRtcSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStream?: (stream: MediaStream) => void;
  private readonly onSignalOut: SignalOut;

  constructor(onSignalOut: SignalOut) {
    this.onSignalOut = onSignalOut;
  }

  setOnRemoteStream(cb: (stream: MediaStream) => void): void {
    this.onRemoteStream = cb;
    if (this.remoteStream) cb(this.remoteStream);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  attachLocalStream(stream: MediaStream): void {
    this.localStream = stream;
  }

  async acquireLocalMedia(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    });
    this.localStream = stream;
    return stream;
  }

  async startPeer(iceServers: IceServerConfig[]): Promise<void> {
    if (!this.localStream) {
      throw new Error('Câmera e microfone não foram iniciados.');
    }
    this.pc = new RTCPeerConnection({ iceServers: toRtcIceServers(iceServers) });
    this.pc.ontrack = (ev) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      const exists = this.remoteStream
        .getTracks()
        .some((t) => t.id === ev.track.id);
      if (!exists) {
        this.remoteStream.addTrack(ev.track);
      }
      this.onRemoteStream?.(this.remoteStream);
    };
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.onSignalOut({
          type: 'ice-candidate',
          candidate: ev.candidate.toJSON(),
        });
      }
    };
    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.onSignalOut({ type: 'offer', sdp: offer.sdp ?? undefined });
  }

  /** Reenvia offer quando o morador entra na sala (offer inicial pode ter sido perdido). */
  async resendOffer(): Promise<void> {
    if (!this.pc || !this.localStream) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.onSignalOut({ type: 'offer', sdp: offer.sdp ?? undefined });
  }

  async handleSignal(msg: IntercomSignalMessage): Promise<void> {
    if (!this.pc) return;
    if (msg.type === 'offer' && msg.sdp && msg.fromRole === 'resident') {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.onSignalOut({ type: 'answer', sdp: answer.sdp ?? undefined });
      return;
    }
    if (msg.type === 'answer' && msg.sdp) {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
      return;
    }
    if (msg.type === 'ice-candidate' && msg.candidate) {
      try {
        await this.pc.addIceCandidate(msg.candidate);
      } catch {
        /* ignorar candidato inválido/duplicado */
      }
    }
  }

  stop(): void {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
  }
}
