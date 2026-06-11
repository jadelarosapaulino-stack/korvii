import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';

interface CacheEntry {
  readonly expiresAt: number;
  readonly response: HttpResponse<unknown>;
}

const cache = new Map<string, CacheEntry>();

export const cacheInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  if (req.method !== 'GET') {
    return next(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) cache.clear();
      }),
    );
  }

  const ttl = ttlFor(req.urlWithParams);
  if (!ttl || req.headers.get('Cache-Control') === 'no-cache') return next(req);

  const key = cacheKey(req.urlWithParams);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return of(cached.response.clone());

  cache.delete(key);
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(key, {
          expiresAt: Date.now() + ttl,
          response: event.clone(),
        });
      }
    }),
  );
};

function cacheKey(url: string): string {
  const token = localStorage.getItem('ruta_segura_token') ?? 'anonymous';
  return `${token}|${url}`;
}

function ttlFor(url: string): number {
  const path = pathname(url);
  if (path === '/education/categories') return minutes(10);
  if (path === '/education/lessons') return minutes(3);
  if (/^\/education\/lessons\/[^/]+$/.test(path)) return minutes(5);
  if (path === '/feature-flags') return minutes(2);
  if (path === '/role-permissions') return minutes(2);
  if (path === '/gamification/settings') return minutes(5);
  if (path === '/reports/map') return seconds(15);
  if (path === '/reports/admin/metrics') return seconds(30);
  if (path === '/analytics/summary') return seconds(30);
  if (path === '/analytics/intelligence') return seconds(45);
  if (path === '/traffic-lights/settings') return minutes(5);
  if (path === '/traffic-lights/green-light-insights') return minutes(1);
  if (path === '/traffic-lights') return minutes(1);
  if (path === '/institutions') return minutes(5);
  return 0;
}

function pathname(url: string): string {
  const parsed = new URL(url, window.location.origin);
  return parsed.pathname.replace(/^\/api(?=\/|$)/, '');
}

function seconds(value: number): number {
  return value * 1000;
}

function minutes(value: number): number {
  return seconds(value * 60);
}
