import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { API_URL } from '../../core/api.config';
import { EducationService, Lesson, LessonProgress } from '../../core/education.service';

@Component({
  selector: 'app-education',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatPaginatorModule, MatProgressBarModule],
  template: `
    <section class="learning-hero">
      <div>
        <span class="rs-eyebrow">Academia preventiva</span>
        <h1>Capacitacion vial</h1>
        <!-- <p>Microcursos para reducir exposición al riesgo, mejorar conducta vial y convertir alertas del mapa en aprendizaje accionable.</p> -->
      </div>

      <div class="hero-stats">
        <div>
          <strong>{{ lessons().length }}</strong>
          <span>lecciones</span>
        </div>
        <div>
          <strong>{{ totalPoints() }}</strong>
          <span>puntos disp.</span>
        </div>
        <div>
          <strong>{{ completedCount() }}</strong>
          <span>completadas</span>
        </div>
      </div>
    </section>

    <section class="learning-layout">
      <aside class="track-panel rs-panel">
        <h2>Ruta de aprendizaje</h2>
        <p>Prioriza modulos breves asociados a seguridad vial urbana y motociclistas.</p>
        <mat-progress-bar mode="determinate" [value]="progress()"></mat-progress-bar>
        <div class="progress-label">
          <span>Progreso general</span>
          <strong>{{ progress() }}%</strong>
        </div>
        <div class="track-list">
          <span><mat-icon>two_wheeler</mat-icon> Motociclistas</span>
          <span><mat-icon>directions_car</mat-icon> Conductores</span>
          <span><mat-icon>health_and_safety</mat-icon> Prevencion</span>
        </div>
      </aside>

      <div class="course-grid">
        @for (lesson of pagedLessons(); track lesson.id; let index = $index) {
          <mat-card class="course-card" [class.completed]="isCompleted(lesson.id)">
            <div class="course-cover">
              @if (lesson.thumbnailUrl) {
                <img [src]="mediaUrl(lesson.thumbnailUrl)" [alt]="lesson.title" />
              } @else {
                <mat-icon>{{ courseIcon(lesson.category) }}</mat-icon>
              }
              <span>{{ index + 1 }}</span>
            </div>

            <mat-card-content>
              <div class="course-meta">
                <mat-chip>{{ lesson.courseTitle || lesson.category }}</mat-chip>
                <span>{{ lesson.durationMinutes || 8 }} min - {{ lesson.points }} pts</span>
              </div>
              <h2>{{ lesson.title }}</h2>
              <p>{{ lessonSummary(lesson.content) }}</p>
              <mat-progress-bar mode="determinate" [value]="lessonProgress(lesson.id)"></mat-progress-bar>
              <div class="lesson-progress-label">
                <span>{{ lessonStatus(lesson.id) }}</span>
                <strong>{{ lessonProgress(lesson.id) }}%</strong>
              </div>
            </mat-card-content>

            <mat-card-actions>
              <a mat-flat-button color="primary" [routerLink]="['/educacion', lesson.id]">
                <mat-icon>{{ isCompleted(lesson.id) ? 'visibility' : lessonProgress(lesson.id) > 0 ? 'menu_book' : 'play_circle' }}</mat-icon>
                {{ isCompleted(lesson.id) ? 'Revisar leccion' : lessonProgress(lesson.id) > 0 ? 'Continuar leccion' : 'Iniciar leccion' }}
              </a>
            </mat-card-actions>
          </mat-card>
        } @empty {
          <mat-card><mat-card-content>No hay lecciones disponibles.</mat-card-content></mat-card>
        }
      </div>

      <mat-paginator
        class="lesson-paginator"
        [length]="lessons().length"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[6, 9, 12]"
        showFirstLastButtons
        (page)="onPage($event)">
      </mat-paginator>
    </section>
  `,
  styleUrls: ['./education.component.css'],
})
export class EducationComponent implements OnInit {
  lessons = signal<Lesson[]>([]);
  pageIndex = signal(0);
  pageSize = signal(6);
  progressByLesson = signal<Record<string, LessonProgress>>({});
  pagedLessons = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.lessons().slice(start, start + this.pageSize());
  });
  totalPoints = computed(() => this.lessons().reduce((total, lesson) => total + lesson.points, 0));
  completedCount = computed(() => Object.values(this.progressByLesson()).filter((progress) => progress.completed).length);
  progress = computed(() => {
    const total = this.lessons().length;
    const progressTotal = this.lessons().reduce((sum, lesson) => sum + this.lessonProgress(lesson.id), 0);
    return total ? Math.round(progressTotal / total) : 0;
  });

  constructor(private readonly education: EducationService) {}

  ngOnInit(): void {
    this.education.lessons().subscribe({
      next: (lessons) => {
        this.lessons.set(lessons);
        this.clampPageIndex();
      },
      error: () => {
        this.lessons.set([]);
        this.pageIndex.set(0);
      },
    });
    this.loadProgress();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  isCompleted(id: string) {
    return this.progressByLesson()[id]?.completed ?? false;
  }

  lessonProgress(id: string) {
    const progress = this.progressByLesson()[id];
    if (!progress) return 0;
    return progress.completed ? 100 : progress.progressPercent;
  }

  lessonStatus(id: string) {
    if (this.isCompleted(id)) return 'Completada';
    return this.lessonProgress(id) > 0 ? 'En progreso' : 'Sin iniciar';
  }

  courseIcon(category: string) {
    const normalized = category.toLowerCase();
    if (normalized.includes('moto')) return 'two_wheeler';
    if (normalized.includes('conductor')) return 'directions_car';
    return 'health_and_safety';
  }

  mediaUrl(url: string) {
    return url.startsWith('/uploads') ? `${API_URL.replace('/api', '')}${url}` : url;
  }

  lessonSummary(content: string) {
    const element = document.createElement('div');
    element.innerHTML = content;
    const text = element.textContent?.trim() || '';
    return text.length > 130 ? `${text.slice(0, 130)}...` : text;
  }

  private loadProgress() {
    this.education.myProgress().subscribe({
      next: (progressRows) => {
        this.progressByLesson.set(
          progressRows.reduce<Record<string, LessonProgress>>((acc, row) => {
            acc[row.lesson.id] = row;
            return acc;
          }, {}),
        );
      },
      error: () => this.progressByLesson.set({}),
    });
  }

  private clampPageIndex() {
    const maxPage = Math.max(Math.ceil(this.lessons().length / this.pageSize()) - 1, 0);
    if (this.pageIndex() > maxPage) this.pageIndex.set(maxPage);
  }

}
