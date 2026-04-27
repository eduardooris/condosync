import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/domains/documents/services/documents.service';
import type { DocumentFormInput } from '@/domains/documents/schemas/documents.schema';

export function useDocumentsPage(condominiumId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['documents', condominiumId];

  const documentsQuery = useQuery({
    queryKey,
    queryFn: () => documentsService.list(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: DocumentFormInput) =>
      documentsService.create(condominiumId!, {
        title: payload.title,
        description: payload.description,
        category: payload.category,
        documentDate: payload.documentDate,
        visibility: payload.visibility,
        file: payload.file[0]!,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => documentsService.remove(condominiumId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { documentsQuery, createMutation, removeMutation };
}
