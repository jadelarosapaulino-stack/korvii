import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ReportStatus } from "../../../common/enums/report-status.enum";

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ReportStatus, example: ReportStatus.VALIDATED })
  @IsEnum(ReportStatus)
  toStatus: ReportStatus;

  @ApiPropertyOptional({
    example: "Reporte validado para intervención institucional.",
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
