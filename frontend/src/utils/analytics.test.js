import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  initializeAnalytics,
  resetAnalyticsForTests,
  setAnalyticsConsent,
  trackEvent,
} from './analytics';

describe('analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelectorAll('[data-analytics="ga4"]').forEach((node) => node.remove());
    delete window.gtag;
    delete window.dataLayer;
    resetAnalyticsForTests();
  });

  test('does not send events without consent', () => {
    expect(trackEvent('page_view')).toBe(false);
    expect(window.dataLayer).toBeUndefined();
  });

  test('loads GA4 once and sends events after consent', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    expect(initializeAnalytics('G-TEST123')).toBe(true);
    expect(initializeAnalytics('G-TEST123')).toBe(false);
    expect(trackEvent('add_to_cart', { value: 10 })).toBe(true);
    expect(document.head.querySelectorAll('[data-analytics="ga4"]')).toHaveLength(1);
    expect(window.dataLayer.at(-1)[0]).toBe('event');
  });

  test('persists a denied decision', () => {
    setAnalyticsConsent('denied');
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
    expect(trackEvent('purchase')).toBe(false);
  });
});
