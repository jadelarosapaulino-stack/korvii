import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAdapterHost } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import { Server, Socket } from "socket.io";
import {
  REALTIME_REPORTS_CHANNEL,
  RealtimeEventPayload,
  RealtimeJwtPayload,
} from "./realtime-event.types";

@Injectable()
export class RealtimeServerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeServerService.name);
  private io?: Server;
  private redis?: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly jwt: JwtService,
  ) {}

  async onApplicationBootstrap() {
    const server = this.httpAdapterHost.httpAdapter.getHttpServer();
    const isProduction =
      this.config.get<string>("NODE_ENV", "development") === "production";
    const corsOrigins = this.config
      .get<string>("CORS_ORIGINS", "http://localhost:4200")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) =>
        origin && (isProduction ? !origin.includes("localhost") : true),
      );

    this.io = new Server(server, {
      path: this.config.get<string>("REALTIME_SOCKET_PATH", "/socket.io"),
      cors: { origin: corsOrigins, credentials: true },
    });

    this.io.use((socket, next) => this.authenticate(socket, next));
    this.io.on("connection", (socket) => this.handleConnection(socket));
    await this.subscribeToRedis();
  }

  private authenticate(socket: Socket, next: (error?: Error) => void) {
    const token = this.extractToken(socket);
    if (!token) return next(new Error("AUTH_REQUIRED"));

    try {
      const payload = this.jwt.verify<RealtimeJwtPayload>(token, {
        secret: this.config.get<string>("JWT_SECRET", "change_me_for_production"),
      });
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("AUTH_INVALID"));
    }
  }

  private extractToken(socket: Socket) {
    const authToken = socket.handshake.auth?.["token"];
    if (typeof authToken === "string" && authToken.trim()) return authToken;

    const queryToken = socket.handshake.query["token"];
    if (typeof queryToken === "string" && queryToken.trim()) return queryToken;

    const header = socket.handshake.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
    return null;
  }

  private handleConnection(socket: Socket) {
    const user = socket.data.user as RealtimeJwtPayload;
    const userId = user.sub ?? user.id;
    const institutionId = user.institutionId ?? user.institution?.id;

    socket.join("reports:map");
    if (userId) socket.join(`reports:user:${userId}`);
    if (institutionId) socket.join(`reports:institution:${institutionId}`);
    if (this.canJoinAdminRoom(user.role)) socket.join("reports:admin");

    socket.emit("realtime.connected", {
      socketId: socket.id,
      rooms: Array.from(socket.rooms).filter((room) => room !== socket.id),
    });
  }

  private canJoinAdminRoom(role: string | undefined) {
    return [
      "MODERATOR",
      "INSTITUTION_ADMIN",
      "INSURANCE_ADMIN",
      "SUPER_ADMIN",
    ].includes(role ?? "");
  }

  private async subscribeToRedis() {
    const url = this.config.get<string>("REDIS_URL", "").trim();
    if (!url) {
      this.logger.warn("REDIS_URL no configurado; realtime queda sin bus.");
      return;
    }

    const redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    redis.on("error", (error) => {
      this.logger.warn(`Redis realtime subscriber no disponible: ${error.message}`);
    });
    redis.on("message", (_channel, message) => this.forwardEvent(message));

    try {
      await redis.connect();
      await redis.subscribe(REALTIME_REPORTS_CHANNEL);
      this.redis = redis;
      this.logger.log(`Suscrito a ${REALTIME_REPORTS_CHANNEL}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis realtime subscriber deshabilitado: ${detail}`);
      redis.disconnect();
    }
  }

  private forwardEvent(message: string) {
    if (!this.io) return;

    try {
      const event = JSON.parse(message) as RealtimeEventPayload;
      const rooms = event.rooms?.length
        ? event.rooms
        : ["reports:map", "reports:admin"];
      rooms.forEach((room) => this.io?.to(room).emit(event.type, event));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Evento realtime invalido: ${detail}`);
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
    this.io?.close();
  }
}
