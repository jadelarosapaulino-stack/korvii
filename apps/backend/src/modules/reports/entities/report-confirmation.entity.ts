import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/user.entity";
import { Report } from "./report.entity";

@Entity("report_confirmations")
@Unique(["report", "user"])
@Index(["latitude", "longitude"])
export class ReportConfirmation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Report, (report) => report.confirmations, {
    onDelete: "CASCADE",
  })
  report: Report;

  @ManyToOne(() => User, { nullable: false, eager: true })
  user: User;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ length: 20, default: "web" })
  source: string;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;
}
