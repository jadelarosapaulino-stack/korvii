import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("system_config")
export class SystemConfigEntry {
  @PrimaryColumn({ length: 80 })
  key: string;

  @Column({ type: "jsonb" })
  value: Record<string, unknown>;

  @UpdateDateColumn()
  updatedAt: Date;
}
