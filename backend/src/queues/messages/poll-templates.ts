export type PollOptionForTemplate = { label: string; sortOrder: number };

function formatPollClosesAt(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

/**
 * WhatsApp — nova enquete aberta no condomínio (RN-04).
 * Inclui nome do condomínio, título, texto opcional e lista de opções.
 */
export function renderPollCreatedWhatsappMessage(
  condominiumName: string,
  title: string,
  description: string | null | undefined,
  options: PollOptionForTemplate[],
  closesAt: Date,
): string {
  const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder);
  const lines: string[] = [
    'CondoSync — nova enquete no seu condomínio',
    '',
    `Condomínio: ${condominiumName}`,
    '',
    `Título: "${title}"`,
  ];
  const desc = description?.trim();
  if (desc) {
    lines.push(
      '',
      `Detalhes: ${desc.slice(0, 400)}${desc.length > 400 ? '…' : ''}`,
    );
  }
  lines.push('', 'Opções de voto:');
  sorted.forEach((o, i) => {
    lines.push(`${i + 1}. ${o.label}`);
  });
  lines.push(
    '',
    `Encerra em: ${formatPollClosesAt(closesAt)} (horário de Brasília).`,
    '',
    'A votação é feita pelo app; apenas o responsável financeiro da unidade pode registrar o voto.',
  );
  return lines.join('\n');
}
