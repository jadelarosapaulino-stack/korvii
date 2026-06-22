import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("gamification_settings")
export class GamificationSetting {
  @PrimaryColumn({ length: 80 })
  key: string;

  @Column({ type: "int" })
  value: number;

  @Column({ type: "varchar", length: 60, nullable: true })
  icon?: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
