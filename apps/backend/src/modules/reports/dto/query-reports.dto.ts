import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { ReportCategory } from "../../../common/enums/report-category.enum";
import { ReportStatus } from "../../../common/enums/report-status.enum";

export class QueryReportsDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: ReportCategory })
  @IsOptional()
  @IsEnum(ReportCategory)
  category?: ReportCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional({ enum: ["web", "mobile", "system"] })
  @IsOptional()
  @IsIn(["web", "mobile", "system"])
  source?: "web" | "mobile" | "system";

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRisk?: number;

  @ApiPropertyOptional({
    description: "Texto a buscar en titulo, descripcion o direccion",
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: "Fecha/hora inicial en formato ISO 8601",
    example: "2026-05-21T08:00:00.000Z",
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: "Fecha/hora final en formato ISO 8601",
    example: "2026-05-21T18:00:00.000Z",
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
