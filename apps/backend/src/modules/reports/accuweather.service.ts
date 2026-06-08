import { Injectable, Logger } from "@nestjs/common";
import { WeatherSettingsService } from "./weather-settings.service";

interface OpenMeteoResponse {
  current?: {
    time?: string;
    is_day?: number;
    weather_code?: number;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    rain?: number;
    showers?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    precipitation?: number[];
    rain?: number[];
    showers?: number[];
    weather_code?: number[];
  };
}

interface OpenMeteoFloodResponse {
  daily?: {
    time?: string[];
    river_discharge?: number[];
    river_discharge_max?: number[];
    river_discharge_p75?: number[];
  };
}

interface GoogleWeatherResponse {
  weatherCondition?: {
    iconBaseUri?: string;
    description?: {
      text?: string;
      languageCode?: string;
    };
    type?: string;
  };
  temperature?: {
    degrees?: number;
    unit?: string;
  };
  relativeHumidity?: number;
  isDaytime?: boolean;
}

interface GoogleFloodStatusResponse {
  floodStatuses?: GoogleFloodStatus[];
}

interface GoogleFloodStatus {
  gaugeId?: string;
  qualityVerified?: boolean;
  gaugeLocation?: {
    latitude?: number;
    longitude?: number;
  };
  issuedTime?: string;
  forecastTimeRange?: {
    start?: string;
    end?: string;
  };
  forecastTrend?: string;
  severity?: string;
  source?: string;
}

export interface WeatherFloodRisk {
  enabled: boolean;
  shouldActivateFloodZone: boolean;
  isDayTime?: boolean;
  locationName?: string;
  province?: string;
  weatherText?: string;
  intenseRainStartsAt?: string;
  activationWindowStartsAt?: string;
  riverDischargeCubicMetersPerSecond?: number;
  riverDischargeP75CubicMetersPerSecond?: number;
  reason: string;
  riskLevel: number;
}

export interface WeatherStatus {
  enabled: boolean;
  provider?: "google-forecast" | "open-meteo";
  locationName?: string;
  province?: string;
  weatherText?: string;
  temperatureCelsius?: number;
  weatherCode?: number;
  weatherIcon?: string;
  isDayTime?: boolean;
  hasPrecipitation?: boolean;
  precipitationType?: string;
  relativeHumidity?: number;
  rainLastHoursMm?: number;
  floodRisk: boolean;
  reason: string;
}

@Injectable()
export class AccuWeatherService {
  private readonly logger = new Logger(AccuWeatherService.name);
  private readonly baseUrl = "https://api.open-meteo.com/v1/forecast";
  private readonly floodBaseUrl = "https://flood-api.open-meteo.com/v1/flood";
  private readonly googleWeatherBaseUrl =
    "https://weather.googleapis.com/v1/currentConditions:lookup";
  private readonly googleFloodBaseUrl =
    "https://floodforecasting.googleapis.com/v1";
  private readonly requestTimeoutMs = 8000;
  private readonly warningCooldownMs = 5 * 60 * 1000;
  private readonly lastWarningAt = new Map<string, number>();

  constructor(private readonly weatherSettings: WeatherSettingsService) {}

  async evaluateFloodRisk(
    latitude: number,
    longitude: number,
  ): Promise<WeatherFloodRisk> {
    const settings = this.weatherSettings.get();
    if (!settings.useOpenMeteoForecast) {
      return {
        enabled: false,
        shouldActivateFloodZone: false,
        reason:
          "Open-Meteo Forecast esta desactivado en la configuracion climatica.",
        riskLevel: 0,
      };
    }

    try {
      const weather = await this.fetchForecast(latitude, longitude);
      const current = weather.current ?? {};
      const next24Hours = this.nextHours(weather, 24);
      const currentRainMm = this.currentRainMillimeters(current);
      const forecastProbability = Math.max(
        0,
        ...next24Hours.map((hour) => hour.precipitationProbability),
      );
      const forecastRainMm = next24Hours.reduce(
        (total, hour) => total + hour.rainMillimeters,
        0,
      );
      const now = Date.now();
      const leadMilliseconds = settings.activationLeadMinutes * 60 * 1000;
      const intenseRainEvent = this.findIntenseRainEvent(next24Hours);
      const riverSignal = await this.fetchFloodSignal(
        latitude,
        longitude,
        settings,
      );
      const currentIntenseRain =
        currentRainMm >= settings.intenseRainHourlyThresholdMm ||
        this.isSevereRainCode(current.weather_code);
      const activationWindowStartsAt = intenseRainEvent
        ? intenseRainEvent.timestamp - leadMilliseconds
        : undefined;
      const isInsideActivationWindow =
        currentIntenseRain ||
        Boolean(
          intenseRainEvent &&
            activationWindowStartsAt !== undefined &&
            now >= activationWindowStartsAt &&
            now <= intenseRainEvent.timestamp + 60 * 60 * 1000,
        );

      const shouldActivateFloodZone =
        currentIntenseRain ||
        Boolean(
          intenseRainEvent && isInsideActivationWindow && riverSignal.risk,
        );

      const weatherText = this.weatherCodeText(current.weather_code);
      const reasonParts = [
        weatherText ? `Condicion actual: ${weatherText}.` : "",
        `Probabilidad de lluvia 24h: ${forecastProbability}%.`,
        currentRainMm ? `Lluvia actual: ${currentRainMm.toFixed(1)} mm.` : "",
        forecastRainMm
          ? `Lluvia prevista 24h: ${forecastRainMm.toFixed(1)} mm.`
          : "",
        intenseRainEvent
          ? `Lluvia intensa prevista: ${intenseRainEvent.rainMillimeters.toFixed(1)} mm/h desde ${new Date(intenseRainEvent.timestamp).toLocaleString("es-DO")}.`
          : "No hay lluvia intensa prevista en las proximas 24h.",
        intenseRainEvent && !isInsideActivationWindow
          ? `La zona se activara desde ${new Date(intenseRainEvent.timestamp - leadMilliseconds).toLocaleString("es-DO")}, ${settings.activationLeadMinutes} minutos antes del evento intenso.`
          : "",
        !this.floodProviderEnabled(settings)
          ? "Los proveedores de inundacion estan desactivados en la configuracion climatica."
          : riverSignal.available
            ? riverSignal.provider === "google-flood"
              ? `Google Flood Forecasting: ${riverSignal.statusText}.`
              : `Caudal fluvial GloFAS: ${riverSignal.maxDischarge.toFixed(1)} m3/s${riverSignal.p75Discharge ? `; p75: ${riverSignal.p75Discharge.toFixed(1)} m3/s` : ""}.`
            : "Senal fluvial no disponible para el punto; no se activa reporte automatico solo por pronostico.",
      ].filter(Boolean);

      return {
        enabled: true,
        shouldActivateFloodZone,
        isDayTime:
          current.is_day === undefined ? undefined : current.is_day === 1,
        locationName: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        weatherText,
        intenseRainStartsAt: intenseRainEvent
          ? new Date(intenseRainEvent.timestamp).toISOString()
          : undefined,
        activationWindowStartsAt: intenseRainEvent
          ? new Date(
              intenseRainEvent.timestamp - leadMilliseconds,
            ).toISOString()
          : undefined,
        riverDischargeCubicMetersPerSecond: riverSignal.available
          ? riverSignal.maxDischarge
          : undefined,
        riverDischargeP75CubicMetersPerSecond: riverSignal.available
          ? riverSignal.p75Discharge
          : undefined,
        reason: reasonParts.join(" ") || "Sin indicadores de lluvia relevante.",
        riskLevel: shouldActivateFloodZone ? 5 : 1,
      };
    } catch (error) {
      this.warnThrottled(
        "forecast",
        `No se pudo consultar Open-Meteo: ${this.errorMessage(error)}`,
      );
      return {
        enabled: true,
        shouldActivateFloodZone: false,
        reason: "No se pudo consultar el estado del tiempo.",
        riskLevel: 0,
      };
    }
  }

  async currentStatus(
    latitude: number,
    longitude: number,
  ): Promise<WeatherStatus> {
    const settings = this.weatherSettings.get();
    if (this.isGoogleForecastActive(settings)) {
      const googleStatus = await this.currentGoogleStatus(latitude, longitude);
      if (googleStatus) return googleStatus;
    }

    const risk = await this.evaluateFloodRisk(latitude, longitude);
    if (!risk.enabled)
      return { enabled: false, floodRisk: false, reason: risk.reason };

    try {
      const weather = await this.fetchForecast(latitude, longitude);
      const current = weather.current ?? {};
      const rainLastHoursMm = this.currentRainMillimeters(current);
      const hasPrecipitation =
        rainLastHoursMm > 0 || this.isRainCode(current.weather_code);

      return {
        enabled: true,
        provider: "open-meteo",
        locationName: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        weatherText: this.weatherCodeText(current.weather_code),
        temperatureCelsius: current.temperature_2m,
        weatherCode: current.weather_code,
        weatherIcon: this.weatherIconClass(
          current.weather_code,
          current.is_day === 1,
        ),
        isDayTime:
          current.is_day === undefined ? undefined : current.is_day === 1,
        hasPrecipitation,
        precipitationType: hasPrecipitation ? "Rain" : undefined,
        relativeHumidity: current.relative_humidity_2m,
        rainLastHoursMm,
        floodRisk: risk.shouldActivateFloodZone,
        reason: risk.reason,
      };
    } catch (error) {
      this.warnThrottled(
        "current-status",
        `No se pudo consultar estado actual Open-Meteo: ${this.errorMessage(error)}`,
      );
      return {
        enabled: true,
        provider: "open-meteo",
        floodRisk: false,
        reason: "No se pudo consultar el estado del tiempo.",
      };
    }
  }

  private async fetchForecast(
    latitude: number,
    longitude: number,
  ): Promise<OpenMeteoResponse> {
    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current:
        "temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,weather_code",
      hourly:
        "precipitation_probability,precipitation,rain,showers,weather_code",
      forecast_days: "2",
      timezone: "auto",
    });
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}?${query.toString()}`,
    );
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    return response.json() as Promise<OpenMeteoResponse>;
  }

  private async currentGoogleStatus(
    latitude: number,
    longitude: number,
  ): Promise<WeatherStatus | null> {
    const settings = this.weatherSettings.get();
    const apiKey = settings.premiumApiKey.trim();
    if (!apiKey) return null;

    try {
      const query = new URLSearchParams({
        key: apiKey,
        "location.latitude": String(latitude),
        "location.longitude": String(longitude),
        unitsSystem: "METRIC",
        languageCode: "es",
      });
      const response = await this.fetchWithTimeout(
        `${this.googleWeatherBaseUrl}?${query.toString()}`,
      );
      if (!response.ok)
        throw new Error(`Google Weather HTTP ${response.status}`);

      const current = (await response.json()) as GoogleWeatherResponse;
      const risk = this.weatherSettings.get().useOpenMeteoForecast
        ? await this.evaluateFloodRisk(latitude, longitude)
        : undefined;
      const weatherText =
        current.weatherCondition?.description?.text ||
        this.googleConditionText(current.weatherCondition?.type);

      return {
        enabled: true,
        provider: "google-forecast",
        locationName: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        weatherText,
        temperatureCelsius: current.temperature?.degrees,
        weatherIcon: this.googleWeatherIconUrl(
          current.weatherCondition?.iconBaseUri,
        ),
        isDayTime: current.isDaytime,
        relativeHumidity: current.relativeHumidity,
        floodRisk: Boolean(risk?.shouldActivateFloodZone),
        reason: risk?.reason || "Estado actual consultado con Google Forecast.",
      };
    } catch (error) {
      this.warnThrottled(
        "google-current-status",
        `No se pudo consultar Google Forecast: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private async fetchFloodSignal(
    latitude: number,
    longitude: number,
    settings: {
      floodProvider: string;
      premiumApiKey: string;
      useOpenMeteoFlood: boolean;
      riverDischargeMultiplier: number;
      floodMonitorCountry: string;
      floodMonitorCountries: string[];
    },
  ): Promise<{
    available: boolean;
    risk: boolean;
    maxDischarge: number;
    p75Discharge?: number;
    provider?: "google-flood" | "open-meteo-flood";
    statusText?: string;
  }> {
    if (this.isGoogleFloodActive(settings)) {
      const googleSignal = await this.fetchGoogleFloodSignal(
        latitude,
        longitude,
        settings,
      );
      if (googleSignal.available || !settings.useOpenMeteoFlood) {
        return googleSignal;
      }
    }

    if (!settings.useOpenMeteoFlood) {
      return { available: false, risk: false, maxDischarge: 0 };
    }

    try {
      const query = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        daily: "river_discharge,river_discharge_max,river_discharge_p75",
        forecast_days: "7",
      });
      const response = await this.fetchWithTimeout(
        `${this.floodBaseUrl}?${query.toString()}`,
      );
      if (!response.ok)
        throw new Error(`Open-Meteo Flood HTTP ${response.status}`);

      const flood = (await response.json()) as OpenMeteoFloodResponse;
      const discharges = [
        ...(flood.daily?.river_discharge ?? []),
        ...(flood.daily?.river_discharge_max ?? []),
      ].filter((value) => Number.isFinite(value));
      const p75Values = (flood.daily?.river_discharge_p75 ?? []).filter(
        (value) => Number.isFinite(value),
      );
      const maxDischarge = Math.max(0, ...discharges);
      const p75Discharge = p75Values.length
        ? Math.max(0, ...p75Values)
        : undefined;

      return {
        available: maxDischarge > 0,
        risk:
          p75Discharge !== undefined
            ? maxDischarge >= p75Discharge * settings.riverDischargeMultiplier
            : false,
        maxDischarge,
        p75Discharge,
        provider: "open-meteo-flood",
      };
    } catch (error) {
      this.warnThrottled(
        "flood",
        `No se pudo consultar Open-Meteo Flood: ${this.errorMessage(error)}`,
      );
      return { available: false, risk: false, maxDischarge: 0 };
    }
  }

  private async fetchGoogleFloodSignal(
    latitude: number,
    longitude: number,
    settings: {
      premiumApiKey: string;
      floodMonitorCountry: string;
      floodMonitorCountries: string[];
    },
  ): Promise<{
    available: boolean;
    risk: boolean;
    maxDischarge: number;
    provider: "google-flood";
    statusText: string;
  }> {
    const apiKey = settings.premiumApiKey.trim();
    if (!apiKey) {
      return {
        available: false,
        risk: false,
        maxDischarge: 0,
        provider: "google-flood",
        statusText: "API key de Google Flood no configurada",
      };
    }

    try {
      const countries = settings.floodMonitorCountries?.length
        ? settings.floodMonitorCountries
        : [settings.floodMonitorCountry || "DO"];
      const statuses = (
        await Promise.all(
          countries.map((country) =>
            this.fetchGoogleFloodStatuses(country, apiKey),
          ),
        )
      ).flat();
      const nearbyStatuses = statuses
        .map((status) => ({
          status,
          distanceKm: this.distanceKm(
            latitude,
            longitude,
            status.gaugeLocation?.latitude,
            status.gaugeLocation?.longitude,
          ),
        }))
        .filter((item) => item.distanceKm <= 75);
      const risky = nearbyStatuses.find((item) =>
        ["EXTREME", "SEVERE", "ABOVE_NORMAL"].includes(
          item.status.severity ?? "",
        ),
      );
      const highestSeverity = this.highestGoogleFloodSeverity(
        nearbyStatuses.map((item) => item.status.severity),
      );

      return {
        available: nearbyStatuses.length > 0,
        risk: Boolean(risky),
        maxDischarge: 0,
        provider: "google-flood",
        statusText: nearbyStatuses.length
          ? `${nearbyStatuses.length} medidores cercanos; severidad maxima ${highestSeverity}.`
          : "Sin medidores cercanos reportados por Google Flood.",
      };
    } catch (error) {
      this.warnThrottled(
        "google-flood",
        `No se pudo consultar Google Flood Forecasting: ${this.errorMessage(error)}`,
      );
      return {
        available: false,
        risk: false,
        maxDischarge: 0,
        provider: "google-flood",
        statusText: "Google Flood Forecasting no disponible",
      };
    }
  }

  private async fetchGoogleFloodStatuses(
    countryCode: string,
    apiKey: string,
  ): Promise<GoogleFloodStatus[]> {
    const response = await this.fetchWithTimeout(
      `${this.googleFloodBaseUrl}/floodStatus:searchLatestFloodStatusByArea?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionCode: countryCode,
          pageSize: 200,
          includeNonQualityVerified: false,
        }),
      },
    );
    if (!response.ok)
      throw new Error(`Google Flood HTTP ${response.status}`);

    const data = (await response.json()) as GoogleFloodStatusResponse;
    return data.floodStatuses ?? [];
  }

  private async fetchWithTimeout(
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = new Error(
          `timeout despues de ${this.requestTimeoutMs}ms`,
        ) as Error & { cause?: unknown };
        timeoutError.cause = error;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private warnThrottled(key: string, message: string) {
    const now = Date.now();
    const previous = this.lastWarningAt.get(key) ?? 0;
    if (now - previous < this.warningCooldownMs) return;
    this.lastWarningAt.set(key, now);
    this.logger.warn(
      `${message}. Se omitiran mensajes repetidos por ${Math.round(this.warningCooldownMs / 60000)} minutos.`,
    );
  }

  private isGoogleForecastActive(settings: {
    weatherProvider: string;
    premiumProvider: string;
    premiumApiKey: string;
  }) {
    return (
      Boolean(settings.premiumApiKey.trim()) &&
      (settings.weatherProvider === "Google Weather Forecast API" ||
        settings.premiumProvider === "Google Forecast")
    );
  }

  private isGoogleFloodActive(settings: {
    floodProvider: string;
    premiumProvider?: string;
    premiumApiKey: string;
  }) {
    return (
      Boolean(settings.premiumApiKey.trim()) &&
      (settings.floodProvider === "Google Flood Forecasting API" ||
        settings.premiumProvider === "Google Flood Forecasting API")
    );
  }

  private floodProviderEnabled(settings: {
    floodProvider: string;
    premiumApiKey: string;
    useOpenMeteoFlood: boolean;
  }) {
    return this.isGoogleFloodActive(settings) || settings.useOpenMeteoFlood;
  }

  private highestGoogleFloodSeverity(values: Array<string | undefined>) {
    const order = ["EXTREME", "SEVERE", "ABOVE_NORMAL", "NO_FLOODING"];
    return (
      order.find((severity) => values.includes(severity)) ??
      values.find(Boolean) ??
      "UNKNOWN"
    );
  }

  private distanceKm(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude?: number,
    toLongitude?: number,
  ) {
    if (toLatitude === undefined || toLongitude === undefined)
      return Number.POSITIVE_INFINITY;

    const earthRadiusKm = 6371;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const deltaLatitude = toRadians(toLatitude - fromLatitude);
    const deltaLongitude = toRadians(toLongitude - fromLongitude);
    const a =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(toRadians(fromLatitude)) *
        Math.cos(toRadians(toLatitude)) *
        Math.sin(deltaLongitude / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private googleWeatherIconUrl(iconBaseUri?: string): string | undefined {
    if (!iconBaseUri) return undefined;
    if (iconBaseUri.endsWith(".svg")) return iconBaseUri;
    return `${iconBaseUri}.svg`;
  }

  private googleConditionText(type?: string): string | undefined {
    if (!type) return undefined;
    return type
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    return error.message || error.name;
  }

  private currentRainMillimeters(
    current: OpenMeteoResponse["current"],
  ): number {
    return Math.max(
      0,
      current?.precipitation ?? 0,
      current?.rain ?? 0,
      current?.showers ?? 0,
    );
  }

  private nextHours(weather: OpenMeteoResponse, hours: number) {
    const hourly = weather.hourly ?? {};
    const times = hourly.time ?? [];
    const now = Date.now();

    return times
      .map((time, index) => ({
        timestamp: Date.parse(time),
        precipitationProbability:
          hourly.precipitation_probability?.[index] ?? 0,
        rainMillimeters: Math.max(
          0,
          hourly.precipitation?.[index] ?? 0,
          hourly.rain?.[index] ?? 0,
          hourly.showers?.[index] ?? 0,
        ),
        weatherCode: hourly.weather_code?.[index],
      }))
      .filter(
        (hour) => Number.isFinite(hour.timestamp) && hour.timestamp >= now,
      )
      .slice(0, hours);
  }

  private isRainCode(code?: number): boolean {
    return (
      code !== undefined &&
      [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
        code,
      )
    );
  }

  private isHeavyRainCode(code?: number): boolean {
    return (
      code !== undefined && [63, 65, 66, 67, 81, 82, 95, 96, 99].includes(code)
    );
  }

  private isSevereRainCode(code?: number): boolean {
    return code !== undefined && [65, 67, 82, 95, 96, 99].includes(code);
  }

  private findIntenseRainEvent(
    hours: ReturnType<AccuWeatherService["nextHours"]>,
  ) {
    const settings = this.weatherSettings.get();
    return hours.find((hour, index) => {
      const nextThreeHoursRain = hours
        .slice(index, index + 3)
        .reduce((total, nextHour) => total + nextHour.rainMillimeters, 0);
      const hasEnoughConfidence =
        hour.precipitationProbability >=
          settings.intenseRainProbabilityThreshold ||
        this.isSevereRainCode(hour.weatherCode);

      return (
        hasEnoughConfidence &&
        (hour.rainMillimeters >= settings.intenseRainHourlyThresholdMm ||
          nextThreeHoursRain >= settings.intenseRainThreeHourThresholdMm ||
          this.isSevereRainCode(hour.weatherCode))
      );
    });
  }

  private weatherCodeText(code?: number): string | undefined {
    if (code === undefined) return undefined;
    if (code === 0) return "Despejado";
    if ([1, 2, 3].includes(code)) return "Parcialmente nublado";
    if ([45, 48].includes(code)) return "Niebla";
    if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna";
    if ([61, 63, 65, 66, 67].includes(code)) return "Lluvia";
    if ([71, 73, 75, 77].includes(code)) return "Nieve";
    if ([80, 81, 82].includes(code)) return "Aguaceros";
    if ([95, 96, 99].includes(code)) return "Tormenta";
    return "Condicion meteorologica variable";
  }

  private weatherIconClass(code?: number, isDayTime = true): string {
    const dayPrefix = isDayTime ? "day" : "night-alt";
    if (code === undefined) return "wi-na";
    if (code === 0) return isDayTime ? "wi-day-sunny" : "wi-night-clear";
    if ([1, 2].includes(code))
      return isDayTime ? "wi-day-cloudy" : "wi-night-alt-partly-cloudy";
    if (code === 3) return "wi-cloudy";
    if ([45, 48].includes(code))
      return isDayTime ? "wi-day-fog" : "wi-night-fog";
    if ([51, 53, 55, 56, 57].includes(code)) return `wi-${dayPrefix}-sprinkle`;
    if ([61, 63, 65, 66, 67].includes(code)) return `wi-${dayPrefix}-rain`;
    if ([71, 73, 75, 77].includes(code)) return `wi-${dayPrefix}-snow`;
    if ([80, 81, 82].includes(code)) return `wi-${dayPrefix}-showers`;
    if ([95, 96, 99].includes(code)) return `wi-${dayPrefix}-thunderstorm`;
    return "wi-cloud";
  }
}
