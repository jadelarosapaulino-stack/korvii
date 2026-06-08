import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { InstitutionType } from "../../common/enums/institution-type.enum";

@Entity("institutions")
export class Institution {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 160 })
  name: string;

  @Column({
    type: "enum",
    enum: InstitutionType,
    default: InstitutionType.OTHER,
  })
  type: InstitutionType;

  @Column({ length: 80, nullable: true })
  province?: string;

  @Column({ length: 80, nullable: true })
  municipality?: string;

  @Column({ type: "text", nullable: true })
  coverageArea?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
