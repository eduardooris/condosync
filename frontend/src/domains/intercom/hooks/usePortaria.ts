import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';
import { connectIntercomSocket, emitSignal } from '@/domains/intercom/lib/intercom-socket';
import { VisitorWebRtcSession } from '@/domains/intercom/lib/visitor-webrtc';
import { portariaPublicService } from '@/domains/intercom/services/portaria-public.service';
import type {
  CreateIntercomSessionResponse,
  IntercomSessionStatus,
  PortariaUnit,
} from '@/shared/types/intercom';

export type PortariaStep = 'form' | 'preview' | 'calling' | 'in_call' | 'ended';

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg[0] ?? 'Falha na requisição.';
  }
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro. Tente novamente.';
}

export function usePortaria(accessToken: string) {
  const [step, setStep] = useState<PortariaStep>('form');
  const [session, setSession] = useState<CreateIntercomSessionResponse | null>(null);
  const [callStatus, setCallStatus] = useState<IntercomSessionStatus | null>(null);
  const [statusLabel, setStatusLabel] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const webrtcRef = useRef<VisitorWebRtcSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isStartingCall, setIsStartingCall] = useState(false);

  const unitsQuery = useQuery({
    queryKey: ['portaria', 'units', accessToken],
    queryFn: () => portariaPublicService.listUnits(accessToken),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const statusQuery = useQuery({
    queryKey: ['portaria', 'session-status', session?.sessionId],
    queryFn: () => portariaPublicService.sessionStatus(session!.sessionId),
    enabled: Boolean(session?.sessionId) && (step === 'calling' || step === 'in_call'),
    refetchInterval: step === 'calling' ? 3000 : false,
  });

  const cleanupCall = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    webrtcRef.current?.stop();
    webrtcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      webrtcRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const status = statusQuery.data?.status;
    if (!status) return;
    setCallStatus(status);
    if (status === 'ANSWERED' && step === 'calling') {
      setStep('in_call');
      setStatusLabel('Em chamada');
    }
    if (status === 'MISSED') {
      setStatusLabel('Ninguém atendeu');
      setStep('ended');
      cleanupCall();
    }
    if (status === 'CANCELED_BY_VISITOR' || status === 'ENDED') {
      setStatusLabel('Chamada encerrada');
      setStep('ended');
      cleanupCall();
    }
    if (status === 'REJECTED') {
      setStatusLabel('Aguardando outro morador…');
    }
  }, [statusQuery.data?.status, step, cleanupCall]);

  const requestMedia = useCallback(async () => {
    setMediaError(null);
    try {
      const peer = new VisitorWebRtcSession(() => {});
      const stream = await peer.acquireLocalMedia();
      webrtcRef.current?.stop();
      webrtcRef.current = peer;
      setLocalStream(stream);
      setStep('preview');
    } catch {
      setMediaError(
        'Permita o acesso à câmera e ao microfone para chamar a unidade.',
      );
    }
  }, []);

  const startCall = useCallback(
    async (unitId: string, visitorName: string) => {
      setIsStartingCall(true);
      try {
        const created = await portariaPublicService.createSession(accessToken, {
          unitId,
          visitorName,
        });
        setSession(created);
        setCallStatus(created.status);
        setStep('calling');
        setStatusLabel('Chamando…');

        const socket = connectIntercomSocket(
          created.wsUrl,
          {
            sessionId: created.sessionId,
            role: 'guest',
            token: created.guestWsToken,
          },
          {
            onSignal: (msg) => {
              void webrtcRef.current?.handleSignal(msg);
            },
            onSessionUpdate: (update) => {
              setCallStatus(update.status);
              if (update.status === 'ANSWERED') {
                setStep('in_call');
                setStatusLabel('Em chamada');
              }
              if (
                update.status === 'MISSED' ||
                update.status === 'ENDED' ||
                update.status === 'CANCELED_BY_VISITOR'
              ) {
                setStep('ended');
                setStatusLabel(
                  update.status === 'MISSED'
                    ? 'Ninguém atendeu'
                    : 'Chamada encerrada',
                );
                cleanupCall();
              }
            },
            onParticipantJoined: (event) => {
              if (event.role !== 'resident') return;
              if (import.meta.env.DEV) {
                console.info('[intercom/webrtc] participant_joined resident — reenviando offer');
              }
              void webrtcRef.current?.resendOffer();
            },
          },
        );
        socketRef.current = socket;

        const existingStream = webrtcRef.current?.getLocalStream() ?? localStream;
        const peer = new VisitorWebRtcSession((m) =>
          emitSignal(socket, { sessionId: created.sessionId, ...m }),
        );
        if (existingStream) {
          peer.attachLocalStream(existingStream);
          setLocalStream(existingStream);
        } else {
          const stream = await peer.acquireLocalMedia();
          setLocalStream(stream);
        }
        peer.setOnRemoteStream(setRemoteStream);
        webrtcRef.current = peer;
        await peer.startPeer(created.iceServers);
      } catch (err) {
        toast.error(extractErrorMessage(err));
        setStep('preview');
      } finally {
        setIsStartingCall(false);
      }
    },
    [accessToken, cleanupCall, localStream],
  );

  const cancelCall = useCallback(async () => {
    if (!session) return;
    try {
      await portariaPublicService.cancelSession(
        session.sessionId,
        session.guestWsToken,
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setStatusLabel('Chamada cancelada');
      setStep('ended');
      cleanupCall();
    }
  }, [session, cleanupCall]);

  const endCall = useCallback(async () => {
    if (!session) return;
    try {
      await portariaPublicService.endSession(
        session.sessionId,
        session.guestWsToken,
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setStatusLabel('Chamada encerrada');
      setStep('ended');
      cleanupCall();
    }
  }, [session, cleanupCall]);

  const reset = useCallback(() => {
    cleanupCall();
    setSession(null);
    setCallStatus(null);
    setStatusLabel('');
    setStep('form');
    setMediaError(null);
  }, [cleanupCall]);

  return {
    units: (unitsQuery.data ?? []) as PortariaUnit[],
    unitsLoading: unitsQuery.isLoading,
    unitsError: unitsQuery.isError,
    unitsErrorMessage: unitsQuery.error
      ? extractErrorMessage(unitsQuery.error)
      : 'Link de portaria inválido ou expirado.',
    step,
    setStep,
    session,
    callStatus,
    statusLabel,
    localStream,
    remoteStream,
    mediaError,
    isStartingCall,
    requestMedia,
    startCall,
    cancelCall,
    endCall,
    reset,
  };
}
