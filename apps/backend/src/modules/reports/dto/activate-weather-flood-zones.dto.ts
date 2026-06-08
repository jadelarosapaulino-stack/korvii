import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsLatitude, IsLongitude, IsOptional, IsString } from "class-validator";

export class ActivateWeatherFloodZonesDto {
  @ApiProperty({ example: 18.4861 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -69.9312 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: "Av. 27 de Febrero con Maximo Gomez" })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional({ example: "Distrito Nacional" })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: "Santo Domingo de Guzman" })
  @IsOptional()
  @IsString()
  municipality?: string;
}
