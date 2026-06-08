import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Usuario Demo" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: "ciudadano@demo.com" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ example: "Demo12345" })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: "Distrito Nacional" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: "Santo Domingo" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional({ example: "Motocicleta" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  vehicleType?: string;
}
