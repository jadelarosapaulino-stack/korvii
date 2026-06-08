import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/user.entity";
import { ActivityController } from "./activity.controller";
import { ActivityInterceptor } from "./activity.interceptor";
import { ActivityService } from "./activity.service";
import { UserActivityLog } from "./user-activity.entity";

@Module({
  imports: [TypeOrmModule.forFeature([UserActivityLog, User])],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityInterceptor,
    },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
