import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "Usuario Demo" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @ApiPropertyOptional({ example: "Distrito Nacional" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  province?: string;

  @ApiPropertyOptional({ example: "Santo Domingo" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  municipality?: string;

  @ApiPropertyOptional({ example: "Motocicleta" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  vehicleType?: string;

  @ApiPropertyOptional({ example: "809-555-0101" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(7, 30)
  phone?: string;

  @ApiPropertyOptional({ example: "Repartidor" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 100)
  occupation?: string;

  @ApiPropertyOptional({ example: "Motocicleta" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  mobilityMode?: string;

  @ApiPropertyOptional({ example: "Diario" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  drivingFrequency?: string;

  @ApiPropertyOptional({ example: "Maria Perez" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 120)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: "809-555-0199" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(7, 30)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: "WhatsApp" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 80)
  preferredContactChannel?: string;

  @ApiPropertyOptional({ example: "/uploads/avatars/user.webp" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 255)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: "teal" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 40)
  avatarPreset?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  decisionInsightsConsent?: boolean;
}
