import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ReportStatus } from "../../../common/enums/report-status.enum";
import { User } from "../../users/user.entity";
import { Report } from "./report.entity";

@Entity("status_history")
export class StatusHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Report, (report) => report.history, { onDelete: "CASCADE" })
  report: Report;

  @Column({ type: "enum", enum: ReportStatus, nullable: true })
  fromStatus?: ReportStatus;

  @Column({ type: "enum", enum: ReportStatus })
  toStatus: ReportStatus;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  changedBy?: User;

  @CreateDateColumn()
  createdAt: Date;
}
