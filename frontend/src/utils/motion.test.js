import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, scrollToElement } from './motion';

describe('preferência de movimento', () => {
  afterEach(() => vi.restoreAllMocks());
  it('substitui rolagem suave quando o usuário reduz movimento', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    window.scrollTo = vi.fn();
    expect(prefersReducedMotion()).toBe(true);
    scrollToElement({ top: 0, behavior: 'smooth' });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
