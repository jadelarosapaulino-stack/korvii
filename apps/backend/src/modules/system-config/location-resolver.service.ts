import { Injectable, Logger } from "@nestjs/common";
import { ExternalApiLoggerService } from "./external-api-logger.service";

interface NominatimReverseResponse {
  display_name?: string;
  address?: Record<string, string | undefined>;
}

export interface ResolvedLocation {
  province?: string;
  municipality?: string;
  address?: string;
}

@Injectable()
export class LocationResolverService {
  private readonly logger = new Logger(LocationResolverService.name);
  private readonly cache = new Map<string, ResolvedLocation>();

  constructor(private readonly externalApiLogger: ExternalApiLoggerService) {}

  async reverseGeocode(
    latitude: number,
    longitude: number,
    fallback: ResolvedLocation = {},
  ): Promise<ResolvedLocation> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return this.normalize(fallback);
    }

    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return this.merge(cached, fallback);

    try {
      const query = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
        zoom: "18",
        addressdetails: "1",
        namedetails: "0",
        "accept-language": "es",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
        {
          headers: {
            "User-Agent": "Korvi/0.1 (location resolution)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!response.ok) {
        await this.externalApiLogger.recordHttpFailure({
          provider: "OpenStreetMap",
          service: "Nominatim Reverse Geocoding",
          operation: "report location resolution",
          response,
        });
        return this.normalize(fallback);
      }

      const resolved = this.extract(
        (await response.json()) as NominatimReverseResponse,
        latitude,
        longitude,
      );
      this.cache.set(cacheKey, resolved);
      return this.merge(resolved, fallback);
    } catch (error) {
      this.logger.warn(
        `No se pudo resolver la ubicacion ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.externalApiLogger.recordException({
        provider: "OpenStreetMap",
        service: "Nominatim Reverse Geocoding",
        operation: "report location resolution",
        error,
      });
      return this.normalize(fallback);
    }
  }

  private extract(
    data: NominatimReverseResponse,
    latitude: number,
    longitude: number,
  ): ResolvedLocation {
    const item = data.address ?? {};
    const inferredMunicipality = this.inferGreaterSantoDomingo(
      latitude,
      longitude,
    );
    const province = inferredMunicipality
      ? inferredMunicipality === "Santo Domingo de Guzman"
        ? "Distrito Nacional"
        : "Santo Domingo"
      : this.cleanAdministrativeName(
          item.state || item.province || item.region || item.state_district,
        );
    const municipality =
      inferredMunicipality ??
      this.cleanAdministrativeName(
        item.municipality ||
          item.city ||
          item.town ||
          item.village ||
          item.county ||
          item.city_district,
      );
    const street = [item.house_number, item.road || item.pedestrian || item.footway]
      .filter(Boolean)
      .join(" ");
    const sector =
      item.neighbourhood || item.suburb || item.quarter || item.residential;
    const exactAddress =
      [street, sector].filter(Boolean).join(", ") || data.display_name;

    return this.normalize({
      province,
      municipality,
      address: exactAddress,
    });
  }

  private merge(
    resolved: ResolvedLocation,
    fallback: ResolvedLocation,
  ): ResolvedLocation {
    return this.normalize({
      province: resolved.province || fallback.province,
      municipality: resolved.municipality || fallback.municipality,
      address: resolved.address || fallback.address,
    });
  }

  private normalize(location: ResolvedLocation): ResolvedLocation {
    return {
      province: this.limit(location.province, 80),
      municipality: this.limit(location.municipality, 80),
      address: this.limit(location.address, 220),
    };
  }

  private limit(value: string | undefined, maxLength: number) {
    const normalized = value?.replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, maxLength) : undefined;
  }

  private cleanAdministrativeName(value: string | undefined) {
    return value
      ?.replace(/^Provincia\s+/i, "")
      .replace(/^Municipio\s+/i, "")
      .trim();
  }

  private inferGreaterSantoDomingo(
    latitude: number,
    longitude: number,
  ): string | undefined {
    if (
      latitude >= 18.4 &&
      latitude <= 18.52 &&
      longitude >= -69.99 &&
      longitude <= -69.86
    ) {
      return "Santo Domingo de Guzman";
    }
    if (
      latitude >= 18.42 &&
      latitude <= 18.6 &&
      longitude >= -69.92 &&
      longitude <= -69.72
    ) {
      return "Santo Domingo Este";
    }
    if (
      latitude >= 18.48 &&
      latitude <= 18.66 &&
      longitude >= -70.05 &&
      longitude < -69.88
    ) {
      return "Santo Domingo Norte";
    }
    if (
      latitude >= 18.38 &&
      latitude <= 18.58 &&
      longitude >= -70.12 &&
      longitude < -69.95
    ) {
      return "Santo Domingo Oeste";
    }
    return undefined;
  }
}
