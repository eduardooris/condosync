import { HttpException, HttpStatus } from '@nestjs/common';
import { AsaasErrorResponse } from './asaas.types';

/**
 * Erros do domínio de integração Asaas. Não vazam detalhes internos pro
 * cliente — cada exception mapeia para um HTTP + `code` que a UI consegue
 * mostrar de forma amigável.
 *
 * Ver tabela de códigos em `docs/06_pagamentos_asaas.md §6.5`.
 */

export type AsaasErrorCode =
  | 'ASAAS_NOT_CONFIGURED'
  | 'ASAAS_AUTH_FAILED'
  | 'ASAAS_VALIDATION_FAILED'
  | 'ASAAS_DUPLICATE_PAYMENT'
  | 'ASAAS_CPF_CNPJ_IN_USE'
  | 'ASAAS_BLOCKED_ACCOUNT'
  | 'ASAAS_UPSTREAM_TIMEOUT'
  | 'ASAAS_UPSTREAM_ERROR'
  | 'PAYMENT_ACCOUNT_NOT_FOUND'
  | 'PAYMENT_ACCOUNT_NOT_ACTIVE';

export class AsaasException extends HttpException {
  readonly code: AsaasErrorCode;
  /** Body cru do Asaas, quando aplicável — útil pra debug em logs. */
  readonly upstream?: AsaasErrorResponse | string | null;

  constructor(
    code: AsaasErrorCode,
    message: string,
    status: HttpStatus,
    upstream?: AsaasErrorResponse | string | null,
  ) {
    super(
      { statusCode: status, message, code, ...(upstream ? { upstream } : {}) },
      status,
    );
    this.code = code;
    this.upstream = upstream ?? null;
  }
}

export function asaasNotConfigured(): AsaasException {
  return new AsaasException(
    'ASAAS_NOT_CONFIGURED',
    'Integração Asaas desativada ou sem credenciais.',
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

export function asaasUpstreamTimeout(): AsaasException {
  return new AsaasException(
    'ASAAS_UPSTREAM_TIMEOUT',
    'A Asaas não respondeu a tempo. Tente novamente em instantes.',
    HttpStatus.GATEWAY_TIMEOUT,
  );
}

export function asaasUpstreamError(
  upstream: AsaasErrorResponse | string,
): AsaasException {
  return new AsaasException(
    'ASAAS_UPSTREAM_ERROR',
    'Falha ao comunicar com a Asaas.',
    HttpStatus.BAD_GATEWAY,
    upstream,
  );
}

export function asaasAuthFailed(): AsaasException {
  return new AsaasException(
    'ASAAS_AUTH_FAILED',
    'Credenciais Asaas inválidas ou expiradas.',
    HttpStatus.UNAUTHORIZED,
  );
}

export function asaasValidation(
  upstream: AsaasErrorResponse,
): AsaasException {
  return new AsaasException(
    'ASAAS_VALIDATION_FAILED',
    'Dados rejeitados pela Asaas.',
    HttpStatus.UNPROCESSABLE_ENTITY,
    upstream,
  );
}

export function asaasDuplicate(): AsaasException {
  return new AsaasException(
    'ASAAS_DUPLICATE_PAYMENT',
    'Já existe uma cobrança com este externalReference.',
    HttpStatus.CONFLICT,
  );
}

export function asaasCpfCnpjInUse(
  upstream?: AsaasErrorResponse,
): AsaasException {
  return new AsaasException(
    'ASAAS_CPF_CNPJ_IN_USE',
    'Este CPF/CNPJ já tem uma conta digital ativa (regra do Banco Central — ' +
      'uma conta digital por CPF/CNPJ). Caminhos possíveis: ' +
      '(a) usar o CNPJ do condomínio em vez do CPF do síndico (se o condo for PJ); ' +
      '(b) usar o CPF de um subsíndico/conselheiro como titular; ' +
      '(c) pedir ao titular para encerrar a conta existente em asaas.com.',
    HttpStatus.CONFLICT,
    upstream,
  );
}

// 423 LOCKED — não está exposto no enum HttpStatus dessa versão do Nest;
// usamos o literal numérico (Nest aceita `number` no construtor de HttpException).
const HTTP_LOCKED = 423 as HttpStatus;

export function asaasBlocked(): AsaasException {
  return new AsaasException(
    'ASAAS_BLOCKED_ACCOUNT',
    'Subconta Asaas bloqueada — entre em contato com o suporte Asaas.',
    HTTP_LOCKED,
  );
}
