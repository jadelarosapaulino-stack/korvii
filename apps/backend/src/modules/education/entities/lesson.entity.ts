import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("lessons")
export class Lesson {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 160 })
  title: string;

  @Column({ type: "text" })
  content: string;

  @Column({ length: 80 })
  category: string;

  @Column({ length: 120, nullable: true })
  courseTitle?: string;

  @Column({ type: "text", nullable: true })
  videoUrl?: string;

  @Column({ type: "text", nullable: true })
  thumbnailUrl?: string;

  @Column({ default: 8 })
  durationMinutes: number;

  @Column({ default: 10 })
  points: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
