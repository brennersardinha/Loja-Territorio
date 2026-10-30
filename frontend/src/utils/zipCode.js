// Máscara 00000-000 enquanto o cliente digita.
export function formatZipCode(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

// Endereço a partir do CEP (ViaCEP). Retorna null quando o CEP não existe ou o serviço falha.
export async function lookupZipCode(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();
    if (!response.ok || data.erro) return null;
    return { street: data.logradouro || '', neighborhood: data.bairro || '', city: data.localidade || '', state: data.uf || '' };
  } catch {
    return null;
  }
}
