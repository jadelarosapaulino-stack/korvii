import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorLoggingInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        console.error('[API error]', {
          method: req.method,
          url: req.urlWithParams,
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
        });
      } else {
        console.error('[HTTP error]', error);
      }

      return throwError(() => error);
    }),
  );
};
