import { describe, expect, it } from 'vitest';
import { securityHeaders, withSecurityHeaders } from './security-headers.ts';

describe('securityHeaders', () => {
  it('lets only the site and the CMS frame the site', () => {
    expect(securityHeaders('https://cms.example.fr/some/path')['Content-Security-Policy']).toBe(
      "frame-ancestors 'self' https://cms.example.fr",
    );
  });
});

describe('withSecurityHeaders', () => {
  const headers = securityHeaders('https://cms.example.fr');

  it('adds the headers to an immutable redirect and keeps its status', () => {
    const secured = withSecurityHeaders(Response.redirect('https://example.fr/', 301), headers);

    expect(secured.status).toBe(301);
    expect(secured.headers.get('Location')).toBe('https://example.fr/');
    expect(secured.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('keeps a header already set by the page', () => {
    const page = new Response('ok', { headers: { 'Referrer-Policy': 'no-referrer' } });

    expect(withSecurityHeaders(page, headers).headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});
