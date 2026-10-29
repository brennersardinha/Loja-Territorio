export function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToElement(options = {}) {
  window.scrollTo({ ...options, behavior: prefersReducedMotion() ? 'auto' : (options.behavior || 'smooth') });
}
