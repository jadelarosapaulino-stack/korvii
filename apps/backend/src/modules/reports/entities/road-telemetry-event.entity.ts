import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/user.entity";

@Entity("road_telemetry_events")
@Index(["eventType", "createdAt"])
@Index(["latitude", "longitude"])
export class RoadTelemetryEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 30 })
  eventType: "impact" | "speed_drop";

  @Column({ type: "decimal", precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: "float", nullable: true })
  accelerationMagnitude?: number | null;

  @Column({ type: "float", nullable: true })
  speedBeforeKmh?: number | null;

  @Column({ type: "float", nullable: true })
  speedAfterKmh?: number | null;

  @Column({ type: "float", nullable: true })
  accuracyMeters?: number | null;

  @Column({ type: "int", default: 0 })
  riskLevel: number;

  @Column({ length: 40, default: "mobile-road-telemetry" })
  source: string;

  @ManyToOne(() => User, { nullable: true, eager: true, onDelete: "SET NULL" })
  user?: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
