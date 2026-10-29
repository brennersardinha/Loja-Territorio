import { describe, expect, it } from 'vitest';
import { formatAttributeValue } from './formatAttributeValue';

describe('formatAttributeValue', () => {
  it('formata listas e objetos sem expor JSON', () => {
    expect(formatAttributeValue(['Azul', 'Verde'])).toBe('Azul, Verde');
    expect(formatAttributeValue({ material: 'Algodão', reciclável: true })).toBe('material: Algodão · reciclável: Sim');
  });
});
