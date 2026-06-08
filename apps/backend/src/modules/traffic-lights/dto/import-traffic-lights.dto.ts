import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class ImportTrafficLightsDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  provinces?: string[];

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  replaceExisting?: boolean;
}
