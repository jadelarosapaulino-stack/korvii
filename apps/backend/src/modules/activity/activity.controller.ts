import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ActivityService } from "./activity.service";
import { CreateActivityEventDto } from "./dto/create-activity-event.dto";

@ApiTags("Activity")
@ApiBearerAuth()
@Controller("activity")
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @UseGuards(JwtAuthGuard)
  @Post("events")
  async recordEvent(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateActivityEventDto,
  ) {
    await this.activity.record({
      userId: user.id,
      method: "CLIENT",
      path: dto.screen ?? dto.platform,
      action: dto.action,
      platform: dto.platform,
      eventType: dto.eventType,
      metadata: {
        element: dto.element,
        ...(dto.metadata ?? {}),
      },
    });

    return { recorded: true };
  }
}
