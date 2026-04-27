import { OccurrenceStatus } from '../../common/enums';

const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  [OccurrenceStatus.OPEN]: 'em aberto',
  [OccurrenceStatus.UNDER_REVIEW]: 'em análise pela administração',
  [OccurrenceStatus.RESOLVED]: 'resolvida',
  [OccurrenceStatus.ARCHIVED]: 'arquivada',
};

export function occurrenceStatusLabelPt(status: OccurrenceStatus): string {
  return STATUS_LABEL[status] ?? String(status);
}

function occurrenceStatusHintPt(status: OccurrenceStatus): string {
  switch (status) {
    case OccurrenceStatus.UNDER_REVIEW:
      return 'A administração está analisando o caso. Você receberá outro aviso se o status mudar.';
    case OccurrenceStatus.RESOLVED:
      return 'Se precisar de algo mais, abra uma nova ocorrência pelo app.';
    case OccurrenceStatus.ARCHIVED:
      return 'Este chamado foi arquivado pela administração.';
    case OccurrenceStatus.OPEN:
      return 'Sua solicitação segue em aberto.';
    default:
      return 'Veja os detalhes no app do condomínio.';
  }
}

/**
 * Texto para WhatsApp quando o síndico altera o status da ocorrência (RN-05).
 * Evita expor enums técnicos (`UNDER_REVIEW`, etc.) ao morador.
 */
export function renderOccurrenceStatusWhatsappMessage(
  title: string,
  status: OccurrenceStatus,
): string {
  const label = occurrenceStatusLabelPt(status);
  return [
    'CondoSync — atualização da sua ocorrência',
    '',
    `"${title}"`,
    '',
    `Situação agora: ${label}.`,
    '',
    occurrenceStatusHintPt(status),
  ].join('\n');
}

export function renderOccurrenceStatusNotificationBody(
  title: string,
  status: OccurrenceStatus,
): string {
  const label = occurrenceStatusLabelPt(status);
  return `A ocorrência "${title}" está ${label}. ${occurrenceStatusHintPt(status)}`;
}
