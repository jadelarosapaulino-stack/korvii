import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { HealthController } from "./health.controller";
import { RealtimeServerService } from "./realtime-server.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
  controllers: [HealthController],
  providers: [RealtimeServerService],
})
export class AppModule {}
