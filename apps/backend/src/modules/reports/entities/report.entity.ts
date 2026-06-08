import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ReportCategory } from "../../../common/enums/report-category.enum";
import { ReportStatus } from "../../../common/enums/report-status.enum";
import { User } from "../../users/user.entity";
import { Institution } from "../../institutions/institution.entity";
import { ReportConfirmation } from "./report-confirmation.entity";
import { ReportPhoto } from "./report-photo.entity";
import { StatusHistory } from "./status-history.entity";

@Entity("reports")
@Index(["latitude", "longitude"])
@Index(["category", "status"])
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 180 })
  title: string;

  @Column({ type: "enum", enum: ReportCategory })
  category: ReportCategory;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  longitude: number;

  @Column({ length: 80, nullable: true })
  province?: string;

  @Column({ length: 80, nullable: true })
  municipality?: string;

  @Column({ length: 220, nullable: true })
  address?: string;

  @Column({ type: "int", default: 3 })
  riskLevel: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  aiAnalysisStatus?: "pending" | "completed" | "failed" | null;

  @Column({ type: "text", nullable: true })
  aiSummary?: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  aiSuggestedCategory?: string | null;

  @Column({ type: "int", nullable: true })
  aiRiskScore?: number | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  aiPriority?: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  aiSuggestedInstitution?: string | null;

  @Column({ type: "decimal", precision: 4, scale: 3, nullable: true })
  aiConfidence?: number | null;

  @Column({ type: "text", nullable: true })
  aiRationale?: string | null;

  @Column({ type: "text", nullable: true })
  aiAnalysisError?: string | null;

  @Column({ type: "timestamp", nullable: true })
  aiProcessedAt?: Date | null;

  @Column({ type: "int", default: 1 })
  confirmationCount: number;

  @Column({ length: 20, default: "web" })
  source: string;

  @Column({ type: "enum", enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @ManyToOne(() => User, { nullable: false, eager: true })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true, eager: true })
  assignedTo?: User | null;

  @ManyToOne(() => Institution, {
    nullable: true,
    eager: true,
    onDelete: "SET NULL",
  })
  assignedInstitution?: Institution | null;

  @Column({ type: "text", nullable: true })
  assignmentNote?: string | null;

  @Column({ type: "timestamp", nullable: true })
  assignedAt?: Date | null;

  @OneToMany(() => ReportPhoto, (photo) => photo.report, {
    cascade: true,
    eager: true,
  })
  photos: ReportPhoto[];

  @OneToMany(() => StatusHistory, (history) => history.report, {
    cascade: true,
  })
  history: StatusHistory[];

  @OneToMany(() => ReportConfirmation, (confirmation) => confirmation.report, {
    cascade: true,
  })
  confirmations: ReportConfirmation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
