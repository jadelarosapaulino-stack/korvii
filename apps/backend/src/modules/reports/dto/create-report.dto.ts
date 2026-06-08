import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsIn,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { ReportCategory } from "../../../common/enums/report-category.enum";

export class CreateReportDto {
  @ApiProperty({ example: "Semáforo dañado en intersección principal" })
  @IsString()
  title: string;

  @ApiProperty({
    enum: ReportCategory,
    example: ReportCategory.TRAFFIC_LIGHT_DAMAGED,
  })
  @IsEnum(ReportCategory)
  category: ReportCategory;

  @ApiProperty({
    example: "El semáforo no funciona y genera riesgo en hora pico.",
  })
  @IsString()
  description: string;

  @ApiProperty({ example: 18.4861 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -69.9312 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: "Distrito Nacional" })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: "Santo Domingo" })
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional({
    example: "Av. San Vicente de Paul, Santo Domingo Este",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  riskLevel?: number;

  @ApiPropertyOptional({ example: "mobile", enum: ["web", "mobile", "system"] })
  @IsOptional()
  @IsIn(["web", "mobile", "system"])
  source?: "web" | "mobile" | "system";

  @ApiPropertyOptional({ example: "9f9b3f73-44f8-4c65-a8ef-d5e41dd7595b" })
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUUID()
  assignedInstitutionId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  photoUrls?: string[];
}
