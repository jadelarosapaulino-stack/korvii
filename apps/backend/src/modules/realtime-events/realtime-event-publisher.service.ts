import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  REALTIME_REPORTS_CHANNEL,
  RealtimeEventPayload,
} from "./realtime-event.types";

@Injectable()
export class RealtimeEventPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeEventPublisherService.name);
  private readonly warningThrottleMs = 60_000;
  private readonly retryAfterFailureMs = 30_000;
  private readonly redis?: Redis;
  private lastWarningAt = 0;
  private unavailableUntil = 0;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL", "").trim();
    const enabled =
      this.config.get<string>("REALTIME_EVENTS_ENABLED", "true") !== "false";
    if (!enabled || !url) return;

    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    this.redis.on("error", (error) => {
      this.warnRedisUnavailable(
        `Redis realtime publisher no disponible: ${error.message}`,
      );
    });
  }

  async publish(event: Omit<RealtimeEventPayload, "occurredAt">) {
    if (!this.redis) return;
    if (Date.now() < this.unavailableUntil) return;

    const payload: RealtimeEventPayload = {
      ...event,
      occurredAt: new Date().toISOString(),
    };

    try {
      if (this.redis.status !== "ready") await this.redis.connect();
      await this.redis.publish(
        REALTIME_REPORTS_CHANNEL,
        JSON.stringify(payload),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.unavailableUntil = Date.now() + this.retryAfterFailureMs;
      this.warnRedisUnavailable(
        `No se pudo publicar evento realtime ${event.type}: ${message}`,
      );
    }
  }

  private warnRedisUnavailable(message: string) {
    const now = Date.now();
    if (now - this.lastWarningAt < this.warningThrottleMs) return;

    this.lastWarningAt = now;
    this.logger.warn(message);
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}
