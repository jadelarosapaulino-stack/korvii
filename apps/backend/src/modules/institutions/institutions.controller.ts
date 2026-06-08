import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { InstitutionsService } from "./institutions.service";

@ApiTags("Institutions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("institutions")
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get()
  findActive(
    @Query("province") province?: string,
    @Query("municipality") municipality?: string,
  ) {
    return this.institutionsService.findActive({ province, municipality });
  }
}
