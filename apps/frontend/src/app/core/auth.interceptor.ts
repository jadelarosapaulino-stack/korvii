import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('ruta_segura_token');
  const headers: Record<string, string> = { 'X-Ruta-Platform': 'web' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return next(
    req.clone({
      setHeaders: headers,
    }),
  );
};
