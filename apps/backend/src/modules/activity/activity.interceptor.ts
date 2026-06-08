import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";
import { ActivityService } from "./activity.service";

type RequestWithUser = {
  method: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  ips?: string[];
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user?: { id?: string };
};

type ResponseLike = {
  statusCode?: number;
};

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly excludedPathFragments = [
    "/activity/events",
    "/auth/login",
    "/auth/register",
    "/auth/activate",
    "/auth/activation-code",
    "/auth/password",
    "/docs",
    "/uploads",
  ];
  private readonly sensitiveBodyKeys = new Set([
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
  ]);

  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<ResponseLike>();
    const userId = request.user?.id;
    const path = this.normalizePath(request.originalUrl ?? request.url ?? "");

    if (!userId || this.shouldSkip(path)) return next.handle();

    const startedAt = Date.now();
    const base = {
      userId,
      method: request.method,
      path,
      action: this.actionName(request.method, path),
      platform: this.headerValue(request.headers["x-ruta-platform"]),
      eventType: "api",
      ip: this.clientIp(request),
      userAgent: this.headerValue(request.headers["user-agent"]),
      metadata: this.metadata(request),
    };

    return next.handle().pipe(
      tap(() => {
        void this.activity
          .record({
            ...base,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          })
          .catch(() => undefined);
      }),
      catchError((error) => {
        void this.activity
          .record({
            ...base,
            statusCode: error?.status ?? response.statusCode ?? 500,
            durationMs: Date.now() - startedAt,
            metadata: {
              ...base.metadata,
              error: error?.message ?? "Unhandled error",
            },
          })
          .catch(() => undefined);
        return throwError(() => error);
      }),
    );
  }

  private shouldSkip(path: string): boolean {
    return this.excludedPathFragments.some((fragment) =>
      path.includes(fragment),
    );
  }

  private normalizePath(path: string): string {
    return path.split("?")[0].slice(0, 240);
  }

  private actionName(method: string, path: string): string {
    const normalized = path.replace(/^\/api\//, "").replace(/^api\//, "");
    return `${method.toUpperCase()} ${normalized}`.slice(0, 120);
  }

  private clientIp(request: RequestWithUser): string | undefined {
    const forwarded = this.headerValue(request.headers["x-forwarded-for"]);
    return (forwarded?.split(",")[0] || request.ips?.[0] || request.ip)?.slice(
      0,
      80,
    );
  }

  private headerValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private metadata(request: RequestWithUser): Record<string, unknown> {
    const bodyKeys = Object.keys(request.body ?? {}).filter(
      (key) => !this.sensitiveBodyKeys.has(key),
    );
    return {
      params: request.params ?? {},
      query: request.query ?? {},
      bodyKeys,
    };
  }
}
