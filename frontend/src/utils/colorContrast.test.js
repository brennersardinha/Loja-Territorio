import { describe, expect, it } from 'vitest';
import { accessibleForeground, contrastRatio, validateThemeContrast } from './colorContrast';

describe('contraste do tema', () => {
  it('aceita a paleta oficial da Sprint 15', () => {
    const result = validateThemeContrast({ primary: '#3b82f6', secondary: '#1f2937', background: '#f8f9fa' });
    expect(result.valid).toBe(true);
    expect(result.textRatio).toBeGreaterThanOrEqual(4.5);
    expect(result.actionRatio).toBeGreaterThanOrEqual(3);
  });

  it('rejeita texto e ação sem contraste', () => {
    const result = validateThemeContrast({ primary: '#f8f9fa', secondary: '#f3f4f6', background: '#ffffff' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('escolhe automaticamente texto legível sobre a ação', () => {
    expect(accessibleForeground('#3b82f6')).toBe('#111827');
    expect(contrastRatio('#3b82f6', accessibleForeground('#3b82f6'))).toBeGreaterThanOrEqual(4.5);
  });
});
