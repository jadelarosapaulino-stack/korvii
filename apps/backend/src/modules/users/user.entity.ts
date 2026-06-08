import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Institution } from "../institutions/institution.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 150 })
  fullName: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: "varchar", length: 80, default: "CITIZEN" })
  role: string;

  @ManyToOne(() => Institution, {
    nullable: true,
    eager: true,
    onDelete: "SET NULL",
  })
  institution?: Institution | null;

  @Column({ length: 80, nullable: true })
  institutionRole?: string;

  @Column({ length: 80, nullable: true })
  province?: string;

  @Column({ length: 80, nullable: true })
  municipality?: string;

  @Column({ length: 80, nullable: true })
  vehicleType?: string;

  @Column({ length: 30, nullable: true })
  phone?: string;

  @Column({ length: 100, nullable: true })
  occupation?: string;

  @Column({ length: 80, nullable: true })
  mobilityMode?: string;

  @Column({ length: 80, nullable: true })
  drivingFrequency?: string;

  @Column({ length: 120, nullable: true })
  emergencyContactName?: string;

  @Column({ length: 30, nullable: true })
  emergencyContactPhone?: string;

  @Column({ length: 80, nullable: true })
  preferredContactChannel?: string;

  @Column({ length: 255, nullable: true })
  avatarUrl?: string;

  @Column({ length: 40, default: "default" })
  avatarPreset: string;

  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ default: false })
  decisionInsightsConsent: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  mustChangePassword: boolean;

  @Column({ type: "varchar", nullable: true, select: false })
  activationCodeHash?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  activationCodeExpiresAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  activatedAt?: Date | null;

  @Column({ type: "varchar", nullable: true, select: false })
  passwordResetCodeHash?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  passwordResetCodeExpiresAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
