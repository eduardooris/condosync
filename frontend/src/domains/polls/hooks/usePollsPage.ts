import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pollsService } from '@/domains/polls/services/polls.service';
import type { PollFormValues } from '@/domains/polls/schemas/polls.schema';
import { queryKeys } from '@/shared/lib/queryKeys';

export function usePollsPage(condominiumId: string | undefined, selectedPollForResults: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.polls.list(condominiumId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.polls.participation(condominiumId) });
  };

  const pollsQuery = useQuery({
    queryKey: queryKeys.polls.list(condominiumId),
    queryFn: () => pollsService.list(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const participationQuery = useQuery({
    queryKey: queryKeys.polls.participation(condominiumId),
    queryFn: () => pollsService.myParticipation(condominiumId!),
    enabled: Boolean(condominiumId),
  });

  const resultsQuery = useQuery({
    queryKey: queryKeys.polls.results(condominiumId, selectedPollForResults),
    queryFn: () => pollsService.results(condominiumId!, selectedPollForResults!),
    enabled: Boolean(condominiumId && selectedPollForResults),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PollFormValues) =>
      pollsService.create(condominiumId!, {
        title: payload.title,
        description: payload.description,
        closesAt: payload.closesAt,
        quorumPercent: 50,
        isAnonymous: true,
        options: [{ label: payload.optionA }, { label: payload.optionB }],
      }),
    onSuccess: invalidate,
  });

  const closeMutation = useMutation({
    mutationFn: (pollId: string) => pollsService.close(condominiumId!, pollId),
    onSuccess: invalidate,
  });

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      pollsService.vote(pollId, { optionId }),
    onSuccess: invalidate,
  });

  return { pollsQuery, participationQuery, resultsQuery, createMutation, closeMutation, voteMutation };
}
