import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/user.entity";
import { UserActivityLog } from "./user-activity.entity";

export interface UserActivityInput {
  userId?: string;
  method: string;
  path: string;
  action: string;
  platform?: string;
  eventType?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly activityRepo: Repository<UserActivityLog>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  async record(input: UserActivityInput): Promise<void> {
    const user = input.userId
      ? await this.usersRepo.findOneBy({ id: input.userId })
      : null;
    if (input.userId && !user) return;

    const activity = this.activityRepo.create({
      user,
      method: input.method,
      path: input.path,
      action: input.action,
      platform: input.platform,
      eventType: input.eventType,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: input.metadata,
    });

    await this.activityRepo.save(activity);
  }
}
