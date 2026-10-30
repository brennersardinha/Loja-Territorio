import { describe, expect, it } from 'vitest';
import { CODE128_PATTERNS, code128Values, code128Widths } from './code128';

describe('Code 128 B', () => {
  it('tem os 107 padrões, únicos e com 11 módulos (parada com 13)', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    CODE128_PATTERNS.forEach((pattern, index) => {
      const modules = [...pattern].reduce((sum, digit) => sum + Number(digit), 0);
      expect(modules).toBe(index === 106 ? 13 : 11);
    });
  });

  it('calcula o dígito verificador (exemplo "Wikipedia")', () => {
    // Início B (104), dados, verificador e parada (106). Soma ponderada 3281 mod 103 = 88.
    expect(code128Values('Wikipedia')).toEqual([104, 55, 73, 75, 73, 80, 69, 68, 73, 65, 88, 106]);
  });

  it('gera larguras com o tamanho esperado para o código da etiqueta', () => {
    const code = 'ETQ-2026-000001-2';
    const widths = code128Widths(code);
    // (início + dados + verificador) × 6 elementos + parada com 7.
    expect(widths).toHaveLength((code.length + 2) * 6 + 7);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe((code.length + 2) * 11 + 13);
  });

  it('recusa caracteres fora do ASCII imprimível', () => {
    expect(() => code128Values('ETIQUETA-É')).toThrow();
    expect(() => code128Values('')).toThrow();
  });
});
