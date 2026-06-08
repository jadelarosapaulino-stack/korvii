import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateTrafficLightDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  municipality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  intersection?: string;

  @IsOptional()
  @IsIn(["active", "unknown", "offline"])
  status?: "active" | "unknown" | "offline";
}
