import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class SocialAuthDto {
  @IsIn(["google", "facebook"])
  provider: "google" | "facebook";

  @IsString()
  @IsNotEmpty()
  token: string;
}
