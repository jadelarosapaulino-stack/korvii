import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { HttpCacheHeadersInterceptor } from "./common/cache/http-cache-headers.interceptor";
import { BackendErrorLoggingInterceptor } from "./common/logging/backend-error-logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("NODE_ENV", "development");
  const isProduction = nodeEnv === "production";
  const apiPrefix = config.get<string>("API_PREFIX", "api");
  const corsOrigins = [
    // Local development
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    // Frontend — Railway internal network
    "http://@ruta-segura/frontend.railway.internal",
    // Frontend — public Railway URL
    "https://korvii.up.railway.app",
    // Additional origins from env (comma-separated)
    ...config
      .get<string>("CORS_ORIGINS", "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];
  const uploadsPath = join(process.cwd(), "uploads");
  const workspaceUploadsPath = join(__dirname, "..", "..", "..", "uploads");

  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });
  if (!existsSync(workspaceUploadsPath))
    mkdirSync(workspaceUploadsPath, { recursive: true });

  app.setGlobalPrefix(apiPrefix);
  app.set("trust proxy", 1);
  app.useStaticAssets(workspaceUploadsPath, { prefix: "/uploads" });
  app.useStaticAssets(uploadsPath, { prefix: "/uploads" });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.enableCors({
    origin: Array.from(new Set(corsOrigins)),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new BackendErrorLoggingInterceptor(),
    new HttpCacheHeadersInterceptor(config),
  );

  if (
    config.get<string>("SWAGGER_ENABLED", isProduction ? "false" : "true") ===
    "true"
  ) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Korvi API")
      .setDescription(
        "API MVP para reportes ciudadanos, educacion vial y analitica institucional.",
      )
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  const port = config.get<number>("PORT", 3000);
  await app.listen(port);
  console.log(`Korvi API running on http://localhost:${port}/${apiPrefix}`);
  if (isProduction) {
    console.log(
      `Public URL:    https://korvii-api-prod.up.railway.app/${apiPrefix}`,
    );
    console.log(
      `Internal URL:  http://@ruta-segura/backend.railway.internal:${port}/${apiPrefix}`,
    );
  }
}

bootstrap();
