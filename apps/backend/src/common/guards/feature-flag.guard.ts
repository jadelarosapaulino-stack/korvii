import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FEATURE_FLAG_KEY } from "../decorators/feature-flag.decorator";
import { FeatureFlagsService } from "../../modules/feature-flags/feature-flags.service";

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const featureKey = this.reflector.getAllAndOverride<string>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureKey || this.featureFlags.isEnabled(featureKey)) return true;
    throw new ForbiddenException("La funcion solicitada esta desactivada.");
  }
}
