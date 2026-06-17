import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfigModule } from "../system-config/system-config.module";
import { User } from "../users/user.entity";
import { EducationController } from "./education.controller";
import { EducationService } from "./education.service";
import { Lesson } from "./entities/lesson.entity";
import { Quiz } from "./entities/quiz.entity";
import { UserProgress } from "./entities/user-progress.entity";

@Module({
  imports: [
    SystemConfigModule,
    TypeOrmModule.forFeature([Lesson, Quiz, UserProgress, User]),
  ],
  controllers: [EducationController],
  providers: [EducationService],
})
export class EducationModule {}
