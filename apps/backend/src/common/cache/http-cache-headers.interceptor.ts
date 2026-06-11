import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable } from "rxjs";
import type { Request, Response } from "express";

interface CachePolicy {
  readonly maxAge: number;
  readonly scope: "public" | "private";
}

@Injectable()
export class HttpCacheHeadersInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled =
      this.config.get<string>("HTTP_CACHE_HEADERS_ENABLED", "true") !== "false";
    if (!enabled || context.getType() !== "http") return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const policy = this.policyFor(request.method, request.path);

    if (policy) {
      response.setHeader(
        "Cache-Control",
        `${policy.scope}, max-age=${policy.maxAge}, stale-while-revalidate=${policy.maxAge}`,
      );
      response.setHeader("Vary", "Authorization, X-Ruta-Platform");
    } else {
      response.setHeader("Cache-Control", "no-store");
    }

    return next.handle();
  }

  private policyFor(method: string, path: string): CachePolicy | null {
    if (method !== "GET") return null;

    const normalized = path.replace(/^\/api(?=\/|$)/, "");
    if (normalized === "/auth/social/config") return this.publicFor(300);
    if (normalized === "/education/categories") return this.privateFor(600);
    if (normalized === "/education/lessons") return this.privateFor(180);
    if (/^\/education\/lessons\/[^/]+$/.test(normalized))
      return this.privateFor(300);
    if (normalized === "/feature-flags") return this.privateFor(120);
    if (normalized === "/role-permissions") return this.privateFor(120);
    if (normalized === "/gamification/settings") return this.privateFor(300);
    if (normalized === "/reports/map") return this.privateFor(15);
    if (normalized === "/reports/admin/metrics") return this.privateFor(30);
    if (normalized === "/analytics/summary") return this.privateFor(30);
    if (normalized === "/analytics/intelligence") return this.privateFor(45);
    if (normalized === "/traffic-lights/settings") return this.privateFor(300);
    if (normalized === "/traffic-lights/green-light-insights")
      return this.privateFor(60);
    if (normalized === "/traffic-lights") return this.privateFor(60);
    if (normalized === "/institutions") return this.privateFor(300);

    return null;
  }

  private publicFor(maxAge: number): CachePolicy {
    return { maxAge, scope: "public" };
  }

  private privateFor(maxAge: number): CachePolicy {
    return { maxAge, scope: "private" };
  }
}
