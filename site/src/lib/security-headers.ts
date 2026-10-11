// Set by the application: the platform's reverse proxy forwards responses unchanged.
export function securityHeaders(cmsPublicUrl: string): Record<string, string> {
  const cmsOrigin = new URL(cmsPublicUrl).origin;
  return {
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Only Directus may frame the site, for the draft preview.
    'Content-Security-Policy': `frame-ancestors 'self' ${cmsOrigin}`,
  };
}

export function withSecurityHeaders(response: Response, headers: Record<string, string>): Response {
  // Redirect responses have immutable headers: copy them before adding ours.
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    if (!secured.headers.has(name)) {
      secured.headers.set(name, value);
    }
  }
  return secured;
}
