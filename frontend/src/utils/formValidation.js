const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(value, label) {
  return String(value ?? '').trim() ? null : `${label} e obrigatorio.`;
}

export function validateAuthForm(values, isRegister) {
  if (isRegister) {
    const nameError = required(values.nome, 'Nome');
    if (nameError) return nameError;
    if (String(values.nome).trim().length < 2) return 'Nome deve ter ao menos 2 caracteres.';
  }
  if (!emailPattern.test(String(values.email ?? '').trim())) return 'Informe um email valido.';
  if (String(values.senha ?? '').length < 6) return 'Senha deve ter ao menos 6 caracteres.';
  return null;
}

export function validateProfileForm(values) {
  const nameError = required(values.nome, 'Nome');
  if (nameError) return nameError;
  if (String(values.nome).trim().length < 2) return 'Nome deve ter ao menos 2 caracteres.';
  return emailPattern.test(String(values.email ?? '').trim()) ? null : 'Informe um email valido.';
}

export function validateProductForm(values) {
  if (String(values.nome ?? '').trim().length < 2) return 'Nome do produto deve ter ao menos 2 caracteres.';
  if (!Number.isFinite(Number(values.preco)) || Number(values.preco) < 0) return 'Preco deve ser um numero maior ou igual a zero.';
  if (!Number.isInteger(Number(values.estoque)) || Number(values.estoque) < 0) return 'Estoque deve ser um numero inteiro maior ou igual a zero.';
  if (['peso_kg','altura_cm','largura_cm','comprimento_cm'].some((field) => values[field] !== undefined && (!Number.isFinite(Number(values[field])) || Number(values[field]) <= 0))) return 'Peso e dimensoes devem ser maiores que zero.';
  try {
    const attributes = JSON.parse(values.atributos_dinamicos || '{}');
    if (attributes === null || Array.isArray(attributes) || typeof attributes !== 'object') return 'Atributos dinamicos devem ser um objeto JSON.';
  } catch {
    return 'Atributos dinamicos devem conter JSON valido.';
  }
  return null;
}

export function validatePriceFilters(values) {
  const min = values.min_preco === '' ? null : Number(values.min_preco);
  const max = values.max_preco === '' ? null : Number(values.max_preco);
  if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) return 'Os precos do filtro devem ser maiores ou iguais a zero.';
  return min !== null && max !== null && min > max ? 'O preco minimo nao pode ser maior que o preco maximo.' : null;
}

export function validateCategoryForm(values) {
  return String(values.nome ?? '').trim().length >= 2 ? null : 'Nome da categoria deve ter ao menos 2 caracteres.';
}

export function validateAddressForm(values) {
  for (const [field, label] of [['label', 'Rotulo'], ['recipient_name', 'Destinatario'], ['street', 'Rua'], ['city', 'Cidade'], ['state', 'Estado'], ['zip_code', 'CEP']]) {
    const error = required(values[field], label);
    if (error) return error;
  }
  if (String(values.state).trim().length !== 2) return 'Estado deve usar a sigla de duas letras.';
  return /^\d{5}-?\d{3}$/.test(String(values.zip_code).trim()) ? null : 'CEP deve estar no formato 00000-000.';
}

export function validateCheckoutForm(values) {
  if (values.shipping_method === 'pickup' && !String(values.shipping_quote_id ?? '').trim()) return null;
  if (!String(values.address_id ?? '').trim() && !String(values.shipping_address_text ?? '').trim()) return 'Selecione ou informe um endereco de entrega.';
  return null;
}
