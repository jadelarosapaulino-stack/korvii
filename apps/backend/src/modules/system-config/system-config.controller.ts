import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes } from "@nestjs/swagger";
import type { Express } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportCategory } from "../../common/enums/report-category.enum";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ImageModerationService } from "../../common/moderation/image-moderation.service";
import { StorageService } from "../../common/storage/storage.service";
import { SystemConfigService } from "./system-config.service";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

@UseGuards(JwtAuthGuard)
@Controller("system/config")
export class SystemConfigController {
  constructor(
    private readonly systemConfig: SystemConfigService,
    private readonly imageModeration: ImageModerationService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  get(@CurrentUser() user: { role?: string }) {
    return this.systemConfig.get(user.role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get("external-api-logs")
  externalApiLogs() {
    return this.systemConfig.externalApiLogs();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete("external-api-logs")
  clearExternalApiLogs() {
    return this.systemConfig.clearExternalApiLogs();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch()
  update(@Body() patch: Record<string, unknown>) {
    return this.systemConfig.update(patch);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post("categories/:category/default-photo")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!allowedImageMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              "Solo se permiten imagenes JPG, PNG o WebP",
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async uploadCategoryDefaultPhoto(
    @Param("category") category: string,
    @UploadedFile() image: Express.Multer.File,
  ) {
    if (!Object.values(ReportCategory).includes(category as ReportCategory)) {
      throw new BadRequestException("Categoria de reporte invalida.");
    }
    if (!image) throw new BadRequestException("La imagen es requerida.");

    await this.imageModeration.assertAllowed(image, "report");
    const defaultPhotoUrl = await this.storage.uploadPublicFile(
      "default-reports",
      image,
    );
    return this.systemConfig.updateCategoryDefaultPhoto(
      category,
      defaultPhotoUrl,
    );
  }
}
