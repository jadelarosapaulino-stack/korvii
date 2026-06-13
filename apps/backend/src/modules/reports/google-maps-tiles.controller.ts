import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";

@Controller("reports/maps")
export class GoogleMapsTilesController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("google/tiles/:z/:x/:y")
  async tile(
    @Param("z") z: string,
    @Param("x") x: string,
    @Param("y") y: string,
    @Query("session") session: string,
    @Res() response: Response,
  ) {
    const tile = await this.reportsService.fetchGoogleMapsTile(
      session,
      Number(z),
      Number(x),
      Number(y),
    );

    response.setHeader("Content-Type", tile.contentType);
    response.setHeader("Cache-Control", tile.cacheControl);
    response.send(tile.body);
  }

  @Get("maptiler/tiles/:z/:x/:y")
  async maptilerTile(
    @Param("z") z: string,
    @Param("x") x: string,
    @Param("y") y: string,
    @Query("style") style: string | undefined,
    @Res() response: Response,
  ) {
    const tile = await this.reportsService.fetchMapTilerTile(
      Number(z),
      Number(x),
      Number(y),
      style,
    );

    response.setHeader("Content-Type", tile.contentType);
    response.setHeader("Cache-Control", tile.cacheControl);
    response.send(tile.body);
  }
}
