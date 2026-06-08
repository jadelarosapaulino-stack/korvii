import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class SaveLessonProgressDto {
  @ApiProperty({ example: 35 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent: number;
}
