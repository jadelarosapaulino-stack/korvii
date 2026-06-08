import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/user.entity";
import { Lesson } from "./lesson.entity";

@Entity("user_progress")
@Index(["user", "lesson"], { unique: true })
export class UserProgress {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", eager: true })
  user: User;

  @ManyToOne(() => Lesson, { onDelete: "CASCADE", eager: true })
  lesson: Lesson;

  @Column({ default: false })
  completed: boolean;

  @Column({ default: 0 })
  progressPercent: number;

  @Column({ default: 0 })
  score: number;

  @Column({ type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  lastAccessedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
