import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ReportCategory } from "../../../common/enums/report-category.enum";
import { User } from "../../users/user.entity";

@Entity("emergency_call_logs")
export class EmergencyCallLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { nullable: false, eager: true })
  user: User;

  @Column({ type: "enum", enum: ReportCategory, nullable: true })
  category?: ReportCategory;

  @Column({ length: 180, nullable: true })
  title?: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ length: 80, nullable: true })
  province?: string;

  @Column({ length: 80, nullable: true })
  municipality?: string;

  @Column({ length: 220, nullable: true })
  address?: string;

  @Column({ length: 30, default: "911" })
  phoneNumber: string;

  @Column({ length: 120, nullable: true })
  source?: string;

  @CreateDateColumn()
  createdAt: Date;
}
