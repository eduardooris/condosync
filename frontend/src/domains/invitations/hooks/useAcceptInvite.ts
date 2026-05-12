import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { NavigateFunction } from 'react-router-dom';
import { authService } from '@/domains/auth/services/auth.service';
import {
  invitationsService,
  type AcceptInvitationInput,
  type AcceptInvitationResponse,
} from '@/domains/invitations/services/invitations.service';
import { queryKeys } from '@/shared/lib/queryKeys';
import {
  acceptInviteSchema,
  type AcceptInviteFormInput,
} from '@/domains/invitations/schemas/accept-invite.schema';
import { useAuthStore } from '@/shared/stores/auth.store';
import {
  canCreateCondominiumFromJwt,
  extractRoleFromJwt,
} from '@/shared/utils/auth';

export function useAcceptInvite(token: string, navigate: NavigateFunction) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const previewQuery = useQuery({
    queryKey: queryKeys.invitations.preview(token),
    queryFn: () => invitationsService.preview(token),
    retry: false,
    enabled: Boolean(token),
  });

  const form = useForm<AcceptInviteFormInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      unitId: '',
      cpf: '',
      phoneWhatsapp: '',
    },
  });

  const persistSession = async (
    accessToken: string,
    refreshToken: string | null,
    email: string,
    fullName: string,
  ) => {
    const role = extractRoleFromJwt(accessToken);
    const canCreateCondominium = canCreateCondominiumFromJwt(accessToken);
    setAuth({
      user: { id: '', name: fullName, email },
      token: accessToken,
      refreshToken,
      role,
      canCreateCondominium,
    });
    try {
      const me = await authService.me();
      setAuth({
        user: {
          id: me.id,
          name: me.fullName ?? me.email.split('@')[0]!,
          email: me.email,
        },
        token: accessToken,
        refreshToken,
        role,
        canCreateCondominium,
      });
    } catch {
      // ignore — token persistido é suficiente.
    }
  };

  const acceptMutation = useMutation({
    mutationFn: (payload: AcceptInvitationInput) =>
      invitationsService.accept(token, payload),
    onSuccess: async (resp: AcceptInvitationResponse, payload) => {
      const preview = previewQuery.data;
      const finalEmail =
        payload.email ?? preview?.email ?? form.getValues('email');
      if (resp.requiresApproval) {
        toast.success(
          'Solicitação enviada! Aguarde a aprovação do administrador.',
        );
        if (resp.accessToken) {
          await persistSession(
            resp.accessToken,
            resp.refreshToken,
            finalEmail ?? '',
            payload.fullName,
          );
          navigate('/no-condo', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
        return;
      }
      toast.success('Convite aceito! Bem-vindo ao condomínio.');
      if (resp.accessToken) {
        await persistSession(
          resp.accessToken,
          resp.refreshToken,
          finalEmail ?? '',
          payload.fullName,
        );
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    },
    onError: () => {
      toast.error('Não foi possível aceitar o convite. Verifique os dados.');
    },
  });

  const submit = form.handleSubmit((values) => {
    const preview = previewQuery.data;
    if (!preview) return;
    if (preview.type === 'GENERIC_LINK' && !preview.unitId && !values.unitId) {
      form.setError('unitId', { message: 'Selecione sua unidade.' });
      return;
    }
    if (preview.type === 'GENERIC_LINK' && !values.email?.trim()) {
      form.setError('email', { message: 'Informe seu e-mail.' });
      return;
    }
    if (preview.type === 'GENERIC_LINK') {
      if (!values.cpf || values.cpf.length !== 11) {
        form.setError('cpf', { message: 'Informe um CPF válido.' });
        return;
      }
      if (!values.phoneWhatsapp || values.phoneWhatsapp.length < 10) {
        form.setError('phoneWhatsapp', {
          message: 'Informe um WhatsApp válido.',
        });
        return;
      }
    }
    const payload: AcceptInvitationInput = {
      fullName: values.fullName.trim(),
      password: values.password,
    };
    if (preview.type === 'GENERIC_LINK') {
      payload.email = values.email?.trim().toLowerCase();
      if (!preview.unitId) payload.unitId = values.unitId;
      payload.cpf = values.cpf;
      payload.phoneWhatsapp = values.phoneWhatsapp;
    }
    acceptMutation.mutate(payload);
  });

  return { form, previewQuery, acceptMutation, submit };
}
