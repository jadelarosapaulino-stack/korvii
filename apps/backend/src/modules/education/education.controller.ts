import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Express } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { FeatureFlag } from "../../common/decorators/feature-flag.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ImageModerationService } from "../../common/moderation/image-moderation.service";
import { StorageService } from "../../common/storage/storage.service";
import { CompleteLessonDto } from "./dto/complete-lesson.dto";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { SaveLessonProgressDto } from "./dto/save-lesson-progress.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";
import { EducationService } from "./education.service";

const allowedVideoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

@ApiTags("Education")
@ApiBearerAuth()
@FeatureFlag("education")
@UseGuards(JwtAuthGuard, FeatureFlagGuard, RolesGuard)
@Controller("education")
export class EducationController {
  constructor(
    private readonly educationService: EducationService,
    private readonly imageModeration: ImageModerationService,
    private readonly storage: StorageService,
  ) {}

  @Get("lessons")
  findLessons() {
    return this.educationService.findLessons();
  }

  @Get("categories")
  findCategories() {
    return this.educationService.findCategories();
  }

  @Get("youtube/metadata")
  youtubeMetadata(@Query("url") url: string) {
    return this.educationService.youtubeMetadata(url);
  }

  @Get("lessons/:id")
  findLesson(@Param("id") id: string) {
    return this.educationService.findLesson(id);
  }

  @Post("lessons")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @ApiConsumes("multipart/form-data", "application/json")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 100 * 1024 * 1024, files: 2 },
        fileFilter: (_req, file, callback) => {
          const isVideo =
            file.fieldname === "video" &&
            allowedVideoMimeTypes.has(file.mimetype);
          const isThumbnail =
            file.fieldname === "thumbnail" &&
            allowedImageMimeTypes.has(file.mimetype);
          if (!isVideo && !isThumbnail) {
            callback(
              new BadRequestException(
                "Solo se permiten videos MP4/WebM/MOV e imagenes JPG/PNG/WebP",
              ),
              false,
            );
            return;
          }

          callback(null, true);
        },
      },
    ),
  )
  async createLesson(
    @Body() dto: CreateLessonDto,
    @UploadedFiles()
    files: {
      video?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    } = {},
  ) {
    if (files.thumbnail?.[0]) {
      await this.imageModeration.assertAllowed(files.thumbnail[0], "education");
    }
    const videoUrl = files.video?.[0]
      ? await this.storage.uploadPublicFile("education", files.video[0])
      : dto.videoUrl;
    const thumbnailUrl = files.thumbnail?.[0]
      ? await this.storage.uploadPublicFile("education", files.thumbnail[0])
      : dto.thumbnailUrl;
    return this.educationService.createLesson({
      ...dto,
      videoUrl,
      thumbnailUrl,
    });
  }

  @Patch("lessons/:id")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @ApiConsumes("multipart/form-data", "application/json")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 100 * 1024 * 1024, files: 2 },
        fileFilter: (_req, file, callback) => {
          const isVideo =
            file.fieldname === "video" &&
            allowedVideoMimeTypes.has(file.mimetype);
          const isThumbnail =
            file.fieldname === "thumbnail" &&
            allowedImageMimeTypes.has(file.mimetype);
          if (!isVideo && !isThumbnail) {
            callback(
              new BadRequestException(
                "Solo se permiten videos MP4/WebM/MOV e imagenes JPG/PNG/WebP",
              ),
              false,
            );
            return;
          }

          callback(null, true);
        },
      },
    ),
  )
  async updateLesson(
    @Param("id") id: string,
    @Body() dto: UpdateLessonDto,
    @UploadedFiles()
    files: {
      video?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    } = {},
  ) {
    if (files.thumbnail?.[0]) {
      await this.imageModeration.assertAllowed(files.thumbnail[0], "education");
    }
    const videoUrl = files.video?.[0]
      ? await this.storage.uploadPublicFile("education", files.video[0])
      : dto.videoUrl;
    const thumbnailUrl = files.thumbnail?.[0]
      ? await this.storage.uploadPublicFile("education", files.thumbnail[0])
      : dto.thumbnailUrl;
    return this.educationService.updateLesson(id, {
      ...dto,
      videoUrl,
      thumbnailUrl,
    });
  }

  @Post("uploads/images")
  @Roles(
    UserRole.MODERATOR,
    UserRole.INSTITUTION_ADMIN,
    UserRole.INSURANCE_ADMIN,
    UserRole.SUPER_ADMIN,
  )
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
  async uploadImage(@UploadedFile() image: Express.Multer.File) {
    await this.imageModeration.assertAllowed(image, "education");
    return { url: await this.storage.uploadPublicFile("education", image) };
  }

  @Post("lessons/:id/complete")
  completeLesson(
    @Param("id") lessonId: string,
    @Body() dto: CompleteLessonDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.educationService.completeLesson(lessonId, user.id, dto);
  }

  @Post("lessons/:id/progress")
  saveLessonProgress(
    @Param("id") lessonId: string,
    @Body() dto: SaveLessonProgressDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.educationService.saveLessonProgress(lessonId, user.id, dto);
  }

  @Get("progress/me")
  myProgress(@CurrentUser() user: { id: string }) {
    return this.educationService.getProgress(user.id);
  }
}
