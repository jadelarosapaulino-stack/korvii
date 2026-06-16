import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[Angular error]', error);
  }
}

export function registerGlobalErrorLogging(): void {
  window.addEventListener('error', (event) => {
    console.error('[Window error]', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled promise rejection]', event.reason);
  });
}
