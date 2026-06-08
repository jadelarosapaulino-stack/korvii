import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Lesson } from "../education/entities/lesson.entity";
import { UserProgress } from "../education/entities/user-progress.entity";
import { GamificationModule } from "../gamification/gamification.module";
import { Institution } from "../institutions/institution.entity";
import { Report } from "../reports/entities/report.entity";
import { RolePermissionsModule } from "../role-permissions/role-permissions.module";
import { User } from "./user.entity";
import { AdminBootstrapService } from "./admin-bootstrap.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Report, UserProgress, Lesson, Institution]),
    GamificationModule,
    RolePermissionsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, AdminBootstrapService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
