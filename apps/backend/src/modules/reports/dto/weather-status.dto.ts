import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsLatitude, IsLongitude } from "class-validator";

export class WeatherStatusDto {
  @ApiProperty({ example: 18.4861 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -69.9312 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}
