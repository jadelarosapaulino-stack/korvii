import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, throwError } from "rxjs";

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  user?: { id?: string; email?: string; role?: string };
};

const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "password",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
  "premiumApiKey",
]);

@Injectable()
export class BackendErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BackendErrorLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const request = context.switchToHttp().getRequest<RequestLike>();
        const status = error instanceof HttpException ? error.getStatus() : 500;
        const payload = this.errorPayload(error);
        const log = {
          status,
          method: request.method,
          url: request.originalUrl ?? request.url,
          ip: request.ip,
          user: request.user
            ? {
                id: request.user.id,
                email: request.user.email,
                role: request.user.role,
              }
            : undefined,
          params: this.sanitize(request.params),
          query: this.sanitize(request.query),
          body: this.sanitize(request.body),
          error: payload,
        };

        const message = `${request.method ?? "HTTP"} ${request.originalUrl ?? request.url ?? ""} -> ${status}`;
        if (status >= 500) {
          this.logger.error(message, error instanceof Error ? error.stack : undefined, JSON.stringify(log));
        } else {
          this.logger.warn(`${message} ${JSON.stringify(log)}`);
        }

        return throwError(() => error);
      }),
    );
  }

  private errorPayload(error: unknown) {
    if (error instanceof HttpException) {
      return {
        name: error.name,
        message: error.message,
        response: this.sanitize(error.getResponse()),
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return { message: String(error) };
  }

  private sanitize(value: unknown): unknown {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sensitiveKeys.has(key) ? "[redacted]" : this.sanitize(entry),
      ]),
    );
  }
}
