import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "ciudadano@demo.com" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiProperty({ example: "Demo12345" })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  encryptedPayload?: string;
}
