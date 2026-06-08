import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator";

export class ActivateAccountDto {
  @ApiProperty({ example: "ciudadano@demo.com" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ example: "123456" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
