import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class CompleteLessonDto {
  @ApiProperty({ example: 90 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;
}
