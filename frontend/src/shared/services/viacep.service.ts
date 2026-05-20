import { digitsOnly } from '@/shared/utils/phone';

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface ResolvedCepAddress {
  street: string;
  province: string;
  city: string;
  state: string;
  complement?: string;
}

/**
 * Consulta endereço pelo CEP (ViaCEP — gratuito, sem API key).
 * @see https://viacep.com.br/
 */
export async function fetchAddressByCep(cep: string): Promise<ResolvedCepAddress | null> {
  const normalized = digitsOnly(cep);
  if (normalized.length !== 8) return null;

  const resp = await fetch(`https://viacep.com.br/ws/${normalized}/json/`, {
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) {
    throw new Error(`viacep http ${resp.status}`);
  }

  const data = (await resp.json()) as ViaCepResponse;
  if (data.erro) return null;

  return {
    street: data.logradouro?.trim() ?? '',
    province: data.bairro?.trim() ?? '',
    city: data.localidade?.trim() ?? '',
    state: data.uf?.trim().toUpperCase() ?? '',
    complement: data.complemento?.trim() || undefined,
  };
}
