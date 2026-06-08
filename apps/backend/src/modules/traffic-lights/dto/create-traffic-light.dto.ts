import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateTrafficLightDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

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
