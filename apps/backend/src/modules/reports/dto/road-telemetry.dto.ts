import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class RoadTelemetryDto {
  @ApiProperty({ enum: ["impact", "speed_drop"], example: "impact" })
  @IsIn(["impact", "speed_drop"])
  eventType: "impact" | "speed_drop";

  @ApiProperty({ example: 18.4861 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -69.9312 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 28.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accelerationMagnitude?: number;

  @ApiPropertyOptional({ example: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(180)
  speedBeforeKmh?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(180)
  speedAfterKmh?: number;

  @ApiPropertyOptional({ example: 3.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: "mobile-road-telemetry" })
  @IsOptional()
  @IsString()
  source?: string;
}
