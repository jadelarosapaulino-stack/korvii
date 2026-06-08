import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Lesson } from "./lesson.entity";

@Entity("quizzes")
export class Quiz {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Lesson, { onDelete: "CASCADE", eager: true })
  lesson: Lesson;

  @Column({ type: "text" })
  question: string;

  @Column({ type: "jsonb" })
  options: string[];

  @Column({ type: "int" })
  correctIndex: number;
}
