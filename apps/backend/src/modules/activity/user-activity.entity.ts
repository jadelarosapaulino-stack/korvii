import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../users/user.entity";

@Entity("user_activity_logs")
@Index(["user", "createdAt"])
@Index(["method", "path"])
export class UserActivityLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  user?: User | null;

  @Column({ length: 12 })
  method: string;

  @Column({ length: 240 })
  path: string;

  @Column({ length: 120 })
  action: string;

  @Column({ length: 20, nullable: true })
  platform?: string;

  @Column({ length: 40, nullable: true })
  eventType?: string;

  @Column({ type: "int", nullable: true })
  statusCode?: number;

  @Column({ type: "int", nullable: true })
  durationMs?: number;

  @Column({ length: 80, nullable: true })
  ip?: string;

  @Column({ length: 320, nullable: true })
  userAgent?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
