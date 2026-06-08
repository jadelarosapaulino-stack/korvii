import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateActivityEventDto {
  @ApiProperty({ example: "click" })
  @IsString()
  @MaxLength(40)
  eventType: string;

  @ApiProperty({ example: "open_report_create" })
  @IsString()
  @MaxLength(120)
  action: string;

  @ApiProperty({ example: "web", enum: ["web", "mobile"] })
  @IsIn(["web", "mobile"])
  platform: "web" | "mobile";

  @ApiPropertyOptional({ example: "/reportes/nuevo" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  screen?: string;

  @ApiPropertyOptional({ example: 'button[title="Nuevo reporte"]' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  element?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
