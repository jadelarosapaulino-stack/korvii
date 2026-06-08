import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type TrafficLightStatus = "active" | "unknown" | "offline";
export type TrafficLightSource = "osm" | "manual" | "institutional";

@Entity("traffic_lights")
@Index(["latitude", "longitude"])
@Index(["status"])
export class TrafficLight {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: "varchar", length: 80, nullable: true })
  province?: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  municipality?: string | null;

  @Column({ type: "varchar", length: 220, nullable: true })
  intersection?: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  osmId?: string | null;

  @Column({ type: "varchar", length: 20, default: "unknown" })
  status: TrafficLightStatus;

  @Column({ type: "varchar", length: 20, default: "manual" })
  source: TrafficLightSource;

  @Column({ type: "timestamp", nullable: true })
  lastObservedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
