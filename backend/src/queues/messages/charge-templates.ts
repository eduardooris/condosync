import { Charge } from '../../database/entities/charge.entity';
import { Resident } from '../../database/entities/resident.entity';
import { PixKeyType } from '../../common/enums';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

function formatBRL(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount ?? '');
  return BRL.format(n);
}

/**
 * `dueDate` vem como `'YYYY-MM-DD'` (coluna `date` do Postgres). Evita
 * `new Date(...)` para não cair em fuso/UTC. Ex.: `2026-04-25` -> `25/04/2026`.
 */
function formatDueDate(dueDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate ?? '');
  if (!m) return dueDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatBillingMonth(billingMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(billingMonth ?? '');
  if (!m) return billingMonth;
  const month = MONTHS_PT[Number(m[2]) - 1] ?? m[2];
  return `${month}/${m[1]}`;
}

function unitLabel(charge: Charge): string {
  const block = charge.unit?.block?.trim();
  const number = charge.unit?.number?.trim();
  if (block && number) return `Bloco ${block} • Unidade ${number}`;
  if (number) return `Unidade ${number}`;
  return 'sua unidade';
}

function condoName(charge: Charge): string {
  return charge.unit?.condominium?.name?.trim() || 'seu condomínio';
}

function pixKeyLabel(type: PixKeyType | string | null | undefined): string {
  switch (type) {
    case PixKeyType.CPF:
      return 'CPF';
    case PixKeyType.CNPJ:
      return 'CNPJ';
    case PixKeyType.EMAIL:
      return 'E-mail';
    case PixKeyType.PHONE:
      return 'Telefone';
    case PixKeyType.EVP:
      return 'Chave aleatória';
    default:
      return 'Chave Pix';
  }
}

function pixKeyLine(charge: Charge): string | null {
  const type = charge.unit?.condominium?.pixKeyType;
  const value = charge.unit?.condominium?.pixKeyValue;
  if (!type || !value) return null;
  return `• ${pixKeyLabel(type)} Pix: *${value}*`;
}

function descriptionLine(charge: Charge): string | null {
  const text = charge.description?.trim();
  if (!text) return null;
  return `• Descrição: ${text}`;
}

function adminContactLines(charge: Charge): string[] {
  const raw =
    charge.unit?.condominium?.adminContactPhone?.replace(/\D/g, '') ?? '';
  if (!raw) return [];
  const br = raw.startsWith('55') ? raw : `55${raw}`;
  return [
    `• WhatsApp da administração: https://wa.me/${br}`,
    `• Telefone da administração: tel:+${br}`,
  ];
}

function greeting(resp: Resident): string {
  const fn = firstName(resp.fullName);
  return fn ? `Olá, ${fn}!` : 'Olá!';
}

export function renderChargeCreatedMessage(
  charge: Charge,
  resp: Resident,
): string {
  const pixLine = pixKeyLine(charge);
  const descLine = descriptionLine(charge);
  const contactLines = adminContactLines(charge);
  return [
    greeting(resp),
    '',
    `Foi gerada uma nova cobrança do condomínio *${condoName(charge)}* para ${unitLabel(charge)}.`,
    '',
    `• Mês de referência: *${formatBillingMonth(charge.billingMonth)}*`,
    `• Valor: *${formatBRL(charge.amount)}*`,
    `• Vencimento: *${formatDueDate(charge.dueDate)}*`,
    ...(descLine ? [descLine] : []),
    ...(pixLine ? [pixLine] : []),
    ...contactLines,
    '',
    'Após o pagamento, envie o comprovante para a administração para baixa da cobrança.',
    '',
    'Em caso de dúvidas, fale com a administração.',
  ].join('\n');
}

export function renderChargeOverdueMessage(
  charge: Charge,
  resp: Resident,
): string {
  const pixLine = pixKeyLine(charge);
  const descLine = descriptionLine(charge);
  const contactLines = adminContactLines(charge);
  return [
    greeting(resp),
    '',
    `Identificamos que a cobrança do condomínio *${condoName(charge)}* referente a ${formatBillingMonth(charge.billingMonth)} está em atraso.`,
    '',
    `• ${unitLabel(charge)}`,
    `• Valor: *${formatBRL(charge.amount)}*`,
    `• Vencimento: *${formatDueDate(charge.dueDate)}*`,
    ...(descLine ? [descLine] : []),
    ...(pixLine ? [pixLine] : []),
    ...contactLines,
    '',
    'Por favor, regularize o quanto antes para evitar acréscimos. Após o pagamento, envie o comprovante para a administração.',
  ].join('\n');
}

/**
 * Reenvio manual (segunda via) solicitado pela administração.
 */
export function renderChargeSecondCopyMessage(
  charge: Charge,
  resp: Resident,
): string {
  const pixLine = pixKeyLine(charge);
  const descLine = descriptionLine(charge);
  const contactLines = adminContactLines(charge);
  return [
    greeting(resp),
    '',
    `*Segunda via* — lembrete da cobrança do condomínio *${condoName(charge)}* para ${unitLabel(charge)}.`,
    '',
    `• Mês de referência: *${formatBillingMonth(charge.billingMonth)}*`,
    `• Valor: *${formatBRL(charge.amount)}*`,
    `• Vencimento: *${formatDueDate(charge.dueDate)}*`,
    ...(descLine ? [descLine] : []),
    ...(pixLine ? [pixLine] : []),
    ...contactLines,
    '',
    'Este aviso foi reenviado a pedido da administração. Após o pagamento, envie o comprovante para a administração.',
    '',
    'Dúvidas: fale com a administração do condomínio.',
  ].join('\n');
}

function paymentRequestMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case 'PIX':
      return 'Pix';
    case 'CASH':
      return 'dinheiro';
    case 'TRANSFER':
      return 'transferência';
    case 'OTHER':
    default:
      return 'outro método';
  }
}

/**
 * Envia ao síndico um aviso de que o morador declarou pagamento e
 * precisa de validação. Não substitui o webhook automático do Asaas —
 * é o caminho para pagamentos fora do gateway.
 */
export function renderChargePaymentRequestedMessage(args: {
  charge: Charge;
  requesterName: string | null;
  adminName: string | null;
}): string {
  const { charge, requesterName, adminName } = args;
  const unit = unitLabel(charge);
  const greetingTo = adminName?.trim().split(/\s+/)[0]
    ? `Olá, ${adminName.trim().split(/\s+/)[0]}!`
    : 'Olá!';
  const noteLine = charge.paymentRequestNote?.trim()
    ? `• Observação do morador: "${charge.paymentRequestNote.trim()}"`
    : null;
  return [
    greetingTo,
    '',
    `*${requesterName ?? 'O morador'}* (${unit}) declarou que pagou a cobrança do condomínio *${condoName(charge)}*.`,
    '',
    `• Mês de referência: *${formatBillingMonth(charge.billingMonth)}*`,
    `• Valor: *${formatBRL(charge.amount)}*`,
    `• Método informado: *${paymentRequestMethodLabel(charge.paymentRequestMethod)}*`,
    ...(noteLine ? [noteLine] : []),
    '',
    'Confirme a baixa pelo CondoSync após receber/conferir o pagamento.',
  ].join('\n');
}

export type ChargeReminderStage =
  | 'D_MINUS_3'
  | 'D_DAY'
  | 'D_PLUS_1'
  | 'D_PLUS_5';

export function renderChargeCollectionReminderMessage(
  charge: Charge,
  resp: Resident,
  stage: ChargeReminderStage,
): string {
  const pixLine = pixKeyLine(charge);
  const descLine = descriptionLine(charge);
  const contactLines = adminContactLines(charge);
  const stageTitle: Record<ChargeReminderStage, string> = {
    D_MINUS_3: 'Lembrete de vencimento (faltam 3 dias)',
    D_DAY: 'Lembrete de vencimento (hoje)',
    D_PLUS_1: 'Lembrete de atraso (1 dia)',
    D_PLUS_5: 'Lembrete de atraso (5 dias)',
  };
  return [
    greeting(resp),
    '',
    `*${stageTitle[stage]}* da cobrança do condomínio *${condoName(charge)}*.`,
    '',
    `• ${unitLabel(charge)}`,
    `• Mês de referência: *${formatBillingMonth(charge.billingMonth)}*`,
    `• Valor: *${formatBRL(charge.amount)}*`,
    `• Vencimento: *${formatDueDate(charge.dueDate)}*`,
    ...(descLine ? [descLine] : []),
    ...(pixLine ? [pixLine] : []),
    ...contactLines,
    '',
    'Se já pagou, desconsidere esta mensagem. Em caso de dúvidas, fale com a administração.',
  ].join('\n');
}
