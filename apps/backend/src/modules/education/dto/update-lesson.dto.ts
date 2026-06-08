import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateLessonDto {
  @ApiPropertyOptional({ example: "Conduccion defensiva urbana" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example:
      "Tecnicas para anticipar riesgos y reducir siniestros en zonas urbanas.",
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: "Conductores" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: "Seguridad vial urbana" })
  @IsOptional()
  @IsString()
  courseTitle?: string;

  @ApiPropertyOptional({ example: "https://www.youtube.com/watch?v=example" })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ example: "/uploads/education/lesson-thumbnail.webp" })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 12, minimum: 1, maximum: 240 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 50, minimum: 0, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  points?: number;
}
