import { Type } from "class-transformer";
import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class RoutePointDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

export class OptimizeRiskRouteDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => RoutePointDto)
  origin: RoutePointDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => RoutePointDto)
  destination: RoutePointDto;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  openRouteServiceApiKey?: string;

  @IsOptional()
  @IsString()
  googleMapsApiKey?: string;
}

export class GoogleMapsTileSessionDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  mapType?: string;
}

export class HighFlowTrafficBoundsDto {
  @Type(() => Number)
  @IsNumber()
  minLatitude: number;

  @Type(() => Number)
  @IsNumber()
  maxLatitude: number;

  @Type(() => Number)
  @IsNumber()
  minLongitude: number;

  @Type(() => Number)
  @IsNumber()
  maxLongitude: number;
}

export class HighFlowTrafficDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => HighFlowTrafficBoundsDto)
  bounds: HighFlowTrafficBoundsDto;

  @IsOptional()
  @IsString()
  googleMapsApiKey?: string;
}
