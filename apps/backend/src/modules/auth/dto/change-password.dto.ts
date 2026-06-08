import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ example: "Demo12345" })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({ example: "NuevaClave123" })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
