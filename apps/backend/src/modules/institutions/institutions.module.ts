import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Institution } from "./institution.entity";
import { InstitutionsController } from "./institutions.controller";
import { InstitutionsService } from "./institutions.service";

@Module({
  imports: [TypeOrmModule.forFeature([Institution])],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
