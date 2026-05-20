import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAddressByCep,
  type ResolvedCepAddress,
} from '@/shared/services/viacep.service';
import { digitsOnly } from '@/shared/utils/phone';

/**
 * Busca endereço por CEP (ViaCEP) com deduplicação do último CEP consultado.
 */
export function useCepAutocomplete() {
  const [isLoading, setIsLoading] = useState(false);
  const lastResolvedCepRef = useRef<string>('');

  const reset = useCallback(() => {
    lastResolvedCepRef.current = '';
  }, []);

  const resolveCep = useCallback(
    async (cepRaw: string, onFilled: (address: ResolvedCepAddress) => void) => {
      const cep = digitsOnly(cepRaw);
      if (cep.length !== 8) {
        reset();
        return;
      }
      if (cep === lastResolvedCepRef.current) return;

      setIsLoading(true);
      try {
        const address = await fetchAddressByCep(cep);
        if (!address) {
          toast.error('CEP não encontrado. Verifique e tente de novo.');
          return;
        }
        lastResolvedCepRef.current = cep;
        onFilled(address);
      } catch {
        toast.error('Não foi possível consultar o CEP. Tente mais tarde.');
      } finally {
        setIsLoading(false);
      }
    },
    [reset],
  );

  return { resolveCep, isLoading, reset };
}
