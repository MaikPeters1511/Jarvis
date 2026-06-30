import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Helper to get the absolute API base URL for non-HttpClient requests (fetch, SignalR).
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5180';
  }
  // Use relative URLs to allow Angular dev server proxy to handle routing in development,
  // and same-origin hosting to work in production.
  return '';
}

/**
 * Adds the API base URL to all relative /api/ and /hubs/ requests.
 * Uses the proxy configuration in development.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // Already absolute URL → pass through
  if (/^https?:\/\//i.test(req.url)) return next(req);

  const apiBase = getApiBaseUrl();
  const url = req.url.startsWith('/') ? `${apiBase}${req.url}` : `${apiBase}/${req.url}`;
  return next(req.clone({ url, withCredentials: true }));
};
