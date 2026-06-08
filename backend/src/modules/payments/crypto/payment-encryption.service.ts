import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Env } from '../../../config/env.schema';

/**
 * Criptografia simétrica AES-256-GCM para segredos por subconta (ex.:
 * `payment_accounts.asaas_api_key`).
 *
 * **Formato persistido** (Buffer único — vai como `bytea` no Postgres):
 *
 *   [ version (1 byte) | iv (12 bytes) | authTag (16 bytes) | ciphertext (N) ]
 *
 *   • `version = 0x01` — espaço para rotacionar key/algoritmo no futuro sem
 *     migration destrutiva (`payment_encryption_v2.service.ts` lerá v1 ainda).
 *   • `iv = 12 bytes` — recomendação NIST para GCM; gerado por request (`randomBytes`).
 *   • `authTag = 16 bytes` — integridade do payload + IV.
 *
 * **Por que não armazenar `iv` e `tag` em colunas separadas?** Acoplaria o
 * formato à tabela; envelopando no próprio buffer dá pra usar o mesmo
 * service em qualquer lugar (cache, queue payload, file storage…) com a
 * mesma garantia.
 */
@Injectable()
export class PaymentEncryptionService implements OnModuleInit {
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_LEN = 12;
  private static readonly TAG_LEN = 16;
  private static readonly VERSION = 0x01;

  /** Chave decodificada (32 bytes). Resolvida no `onModuleInit`. */
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const raw = this.config.get('PAYMENTS_ENCRYPTION_KEY', { infer: true });
    if (!raw) {
      // Sem key → service opera em "modo desabilitado" e qualquer chamada lança.
      // A validação dura está no `env.schema.ts` (exige quando ASAAS_ACCOUNTS_ENABLED).
      return;
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error(
        `PAYMENTS_ENCRYPTION_KEY deve decodificar a 32 bytes (AES-256). Recebeu ${key.length}.`,
      );
    }
    this.key = key;
  }

  /**
   * Encripta uma string UTF-8. Retorna o buffer auto-contido (ver formato no
   * topo do arquivo) — pronto pra salvar em coluna `bytea`.
   */
  encrypt(plaintext: string): Buffer {
    const key = this.requireKey();
    const iv = randomBytes(PaymentEncryptionService.IV_LEN);
    const cipher = createCipheriv(PaymentEncryptionService.ALGO, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([
      Buffer.from([PaymentEncryptionService.VERSION]),
      iv,
      authTag,
      ciphertext,
    ]);
  }

  /**
   * Decripta um buffer produzido por `encrypt()`. Lança quando a versão é
   * desconhecida (rotação para v2 sem migrator) ou quando o `authTag` falha.
   */
  decrypt(envelope: Buffer): string {
    const key = this.requireKey();
    if (
      envelope.length <
      1 + PaymentEncryptionService.IV_LEN + PaymentEncryptionService.TAG_LEN
    ) {
      throw new Error('Envelope inválido: tamanho insuficiente.');
    }
    const version = envelope[0];
    if (version !== PaymentEncryptionService.VERSION) {
      throw new Error(
        `Versão de envelope desconhecida (0x${version.toString(16)}). Esperado 0x01.`,
      );
    }
    let offset = 1;
    const iv = envelope.subarray(
      offset,
      offset + PaymentEncryptionService.IV_LEN,
    );
    offset += PaymentEncryptionService.IV_LEN;
    const authTag = envelope.subarray(
      offset,
      offset + PaymentEncryptionService.TAG_LEN,
    );
    offset += PaymentEncryptionService.TAG_LEN;
    const ciphertext = envelope.subarray(offset);

    const decipher = createDecipheriv(PaymentEncryptionService.ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }

  /** True quando há key carregada — útil pra gates programáticos. */
  isAvailable(): boolean {
    return this.key !== null;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error(
        'PaymentEncryptionService indisponível: PAYMENTS_ENCRYPTION_KEY não configurada.',
      );
    }
    return this.key;
  }
}
