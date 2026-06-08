import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from "class-validator";
import { ReportCategory } from "../../../common/enums/report-category.enum";

export class CreateEmergencyCallLogDto {
  @ApiPropertyOptional({
    enum: ReportCategory,
    example: ReportCategory.ACCIDENT,
  })
  @IsOptional()
  @IsEnum(ReportCategory)
  category?: ReportCategory;

  @ApiPropertyOptional({ example: "Accidente con heridos" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 18.4861 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -69.9312 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: "Santo Domingo" })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: "Santo Domingo Este" })
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional({ example: "Av. San Vicente de Paul" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "911" })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: "Desde modal de nuevo reporte" })
  @IsOptional()
  @IsString()
  source?: string;
}
