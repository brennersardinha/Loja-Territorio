export function formatAttributeValue(value) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${key}: ${formatAttributeValue(nestedValue)}`)
      .join(' · ');
  }
  return String(value);
}
