import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { Loader2, User } from 'lucide-react';
import { authService } from '@/domains/auth/services/auth.service';
import {
  residentsService,
  type MyResidentProfile,
} from '@/domains/residents/services/residents.service';
import {
  editProfileSchema,
  type EditProfileInput,
} from '@/domains/auth/schemas/edit-profile.schema';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { FieldError } from '@/shared/components/ui/FieldError';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useAuthStore } from '@/shared/stores/auth.store';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { MeResponse } from '@/shared/types/api';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: MeResponse | undefined;
  residentProfile?: MyResidentProfile;
  condominiumId?: string;
  useResidentProfileEndpoint?: boolean;
}

function displayNameFromMe(me: MeResponse): string {
  const fn = me.fullName?.trim();
  if (fn) return fn;
  const em = me.email?.trim() ?? '';
  const at = em.indexOf('@');
  if (at > 0) return em.slice(0, at);
  return em || 'Usuário';
}

export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  residentProfile,
  condominiumId,
  useResidentProfileEndpoint = false,
}: EditProfileDialogProps) {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  const form = useForm<EditProfileInput>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: { fullName: '', phoneWhatsapp: '' },
  });

  useEffect(() => {
    if (!open) return;
    const fullName = useResidentProfileEndpoint
      ? residentProfile?.fullName?.trim() ?? profile?.fullName?.trim() ?? ''
      : profile?.fullName?.trim() ?? '';
    const phoneWhatsapp = useResidentProfileEndpoint
      ? residentProfile?.phoneWhatsapp?.trim() ?? profile?.phoneWhatsapp?.trim() ?? ''
      : profile?.phoneWhatsapp?.trim() ?? '';
    form.reset({
      fullName,
      phoneWhatsapp,
    });
  }, [
    open,
    profile,
    residentProfile,
    useResidentProfileEndpoint,
    form,
  ]);

  const mutation = useMutation({
    mutationFn: async (data: EditProfileInput) => {
      if (useResidentProfileEndpoint && condominiumId) {
        const resident = await residentsService.patchMyProfile(condominiumId, {
          fullName: data.fullName,
          phoneWhatsapp: data.phoneWhatsapp,
        });
        const state = useAuthStore.getState();
        return {
          userId: state.user?.id ?? profile?.id ?? '',
          userEmail: state.user?.email ?? profile?.email ?? '',
          userName: resident.fullName,
        };
      }
      const me = await authService.patchMe({
        fullName: data.fullName,
        phoneWhatsapp: data.phoneWhatsapp === '' ? null : data.phoneWhatsapp,
      });
      return {
        userId: me.id,
        userEmail: me.email,
        userName: displayNameFromMe(me),
      };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      if (condominiumId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.residents.myProfile(condominiumId),
        });
      }
      const state = useAuthStore.getState();
      setAuth({
        user: {
          id: result.userId || state.user?.id || '',
          name: result.userName || state.user?.name || 'Usuário',
          email: result.userEmail || state.user?.email || '',
        },
        token: state.token!,
        refreshToken: state.refreshToken,
        role: state.role!,
        canCreateCondominium: state.canCreateCondominium,
      });
      toast.success('Perfil atualizado.');
      onOpenChange(false);
    },
    onError: (err) => {
      const ax = err as AxiosError<{ message?: string }>;
      const msg = ax.response?.data?.message;
      toast.error(msg || 'Não foi possível salvar. Tente novamente.');
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  const fnId = 'edit-profile-fullname';
  const phId = 'edit-profile-phone';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-brand-600 dark:text-brand-300" aria-hidden />
            Editar perfil
          </DialogTitle>
          <DialogDescription>
            {useResidentProfileEndpoint
              ? 'Você está editando o cadastro do morador da unidade no condomínio ativo. Isso reflete no vínculo da unidade.'
              : 'Seu nome aparece no app. O WhatsApp da conta é usado para enviar o link quando você usa Esqueci minha senha na tela de login.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={fnId}>Nome completo</Label>
            <Input
              id={fnId}
              autoComplete="name"
              {...form.register('fullName')}
              aria-invalid={Boolean(form.formState.errors.fullName)}
            />
            {form.formState.errors.fullName?.message ? (
              <FieldError>{form.formState.errors.fullName.message}</FieldError>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={phId}>WhatsApp (DDD + número)</Label>
            <Input
              id={phId}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Ex.: 11 98765-4321"
              {...form.register('phoneWhatsapp')}
              aria-invalid={Boolean(form.formState.errors.phoneWhatsapp)}
            />
            {form.formState.errors.phoneWhatsapp?.message ? (
              <FieldError>{form.formState.errors.phoneWhatsapp.message}</FieldError>
            ) : null}
            <p className="text-ds-xs leading-relaxed text-ds-dim">
              {useResidentProfileEndpoint
                ? 'Este número pertence ao seu cadastro de morador neste condomínio.'
                : 'Deixe em branco só se outro cadastro (morador) já tiver o seu WhatsApp e você preferir receber o link por lá.'}
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
