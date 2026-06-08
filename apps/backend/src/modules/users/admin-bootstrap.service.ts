import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UserRole } from "../../common/enums/user-role.enum";
import { UsersService } from "./users.service";

const adminEmail = "jadelarosapaulino@gmail.com";
const adminPassword = "demo1234";

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly usersService: UsersService) {}

  async onApplicationBootstrap() {
    const existing = await this.usersService.findByEmailWithPassword(
      adminEmail,
    );
    if (existing) return;

    await this.usersService.create({
      fullName: "Administrador",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      activatedAt: new Date(),
      mustChangePassword: true,
    });

    this.logger.log(`Usuario administrador inicial creado: ${adminEmail}`);
  }
}
