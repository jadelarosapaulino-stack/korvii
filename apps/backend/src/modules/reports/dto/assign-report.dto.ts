import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class AssignReportDto {
  @ApiPropertyOptional({ example: "3b74c19f-6df6-4f71-94fb-b220b904c1b2" })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ example: "54a51df0-4578-4ff6-a6d2-98f167014c98" })
  @IsOptional()
  @IsUUID()
  assignedInstitutionId?: string;

  @ApiPropertyOptional({ example: "Asignado para inspeccion de campo." })
  @IsOptional()
  @IsString()
  note?: string;
}
