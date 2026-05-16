/**
 * Gera um "Pix Copia e Cola" (BR Code estático) a partir dos dados do
 * condomínio e da cobrança. Implementa o padrão EMV do Banco Central
 * descrito em https://www.bcb.gov.br/estabilidadefinanceira/pix —
 * versão estática (sem expiração/lote).
 *
 * Não substitui um provider real de pagamentos: enquanto o
 * `IPaymentAdapter` não existir, esta função fornece o código
 * suficiente para o app/PWA exibir o QR e o usuário pagar via app
 * bancário tradicional.
 */
export type BuildPixCodeInput = {
  /** Tipo da chave Pix do condomínio. */
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' | null;
  /** Valor da chave Pix do condomínio. */
  pixKeyValue: string | null;
  /** Nome do recebedor (condomínio). */
  receiverName: string;
  /** Cidade do recebedor (usado no payload — máx 15 chars). */
  receiverCity?: string;
  /** Valor em reais com até 2 casas decimais. */
  amount: string;
  /** ID conciliador (até 25 chars alfanuméricos sem acento). */
  txId: string;
};

const sanitizeAscii = (input: string, maxLength: number): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, maxLength)
    .toUpperCase();

const tlv = (id: string, value: string): string => {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
};

/** Calcula o CRC16-CCITT-FALSE (polinômio 0x1021, init 0xFFFF). */
const crc16 = (payload: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Retorna o BR Code formatado ou `null` quando o condomínio ainda não
 * configurou chave Pix. O app deve esconder o botão "copiar Pix"
 * nesse caso.
 */
export const buildPixBrCode = (input: BuildPixCodeInput): string | null => {
  if (!input.pixKeyType || !input.pixKeyValue) return null;

  const merchantAccount =
    tlv('00', 'br.gov.bcb.pix') + tlv('01', input.pixKeyValue);

  const txId = sanitizeAscii(input.txId, 25) || '***';
  const additionalData = tlv('05', txId);

  const name = sanitizeAscii(input.receiverName || 'CONDOSYNC', 25);
  const city = sanitizeAscii(input.receiverCity || 'BRASIL', 15);

  // Valor com 2 casas, ponto como separador decimal (formato EMV).
  const amount = Number(input.amount).toFixed(2);

  const payloadSemCrc =
    tlv('00', '01') + // Payload Format Indicator
    tlv('26', merchantAccount) + // Merchant Account Info
    tlv('52', '0000') + // Merchant Category Code
    tlv('53', '986') + // Moeda (BRL)
    tlv('54', amount) + // Valor
    tlv('58', 'BR') + // Country code
    tlv('59', name) + // Merchant Name
    tlv('60', city) + // Merchant City
    tlv('62', additionalData) + // Additional Data Field
    '6304'; // CRC tag + length (calculado a seguir)

  const crc = crc16(payloadSemCrc);
  return `${payloadSemCrc}${crc}`;
};
