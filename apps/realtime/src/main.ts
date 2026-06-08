import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("NODE_ENV", "development");
  const isProduction = nodeEnv === "production";
  const port = config.get<number>("REALTIME_PORT", 3001);
  const corsOrigins = config
    .get<string>("CORS_ORIGINS", "http://localhost:4200")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) =>
      origin && (isProduction ? !origin.includes("localhost") : true),
    );

  app.set("trust proxy", 1);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  await app.listen(port);
  Logger.log(`Realtime gateway running on http://localhost:${port}`, "Realtime");
}

bootstrap();
