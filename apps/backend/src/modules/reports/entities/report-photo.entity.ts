import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Report } from "./report.entity";

@Entity("report_photos")
export class ReportPhoto {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Report, (report) => report.photos, { onDelete: "CASCADE" })
  report: Report;

  @Column({ type: "text" })
  url: string;

  @CreateDateColumn()
  createdAt: Date;
}
