import { ElementRef, ViewChild, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { API_URL } from '../../core/api.config';
import { EducationService, Lesson, LessonProgress } from '../../core/education.service';

@Component({
  selector: 'app-education-lesson',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressBarModule],
  template: `
    <section class="lesson-page">
      <header class="lesson-header">
        <a mat-stroked-button routerLink="/education">
          <mat-icon>arrow_back</mat-icon>
          Volver
        </a>
        <div>
          <span class="rs-eyebrow">{{ lesson()?.courseTitle || lesson()?.category || 'Leccion' }}</span>
          <h1>{{ lesson()?.title || 'Cargando leccion' }}</h1>
          <p>{{ lesson()?.durationMinutes || 8 }} min - {{ lesson()?.points || 0 }} pts</p>
        </div>
      </header>

      @if (lesson(); as currentLesson) {
        <section class="lesson-layout">
          <mat-card class="lesson-player-panel">
            @if (currentLesson.videoUrl) {
              <div #videoShell class="video-shell">
                <div class="video-stage">
                  @if (trustedYoutubeEmbedUrl(currentLesson.videoUrl); as youtubeUrl) {
                    <iframe
                      class="youtube-player"
                      [src]="youtubeUrl"
                      title="Video de YouTube"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                      referrerpolicy="strict-origin-when-cross-origin"
                      (load)="onYoutubeLoaded()"
                    ></iframe>
                  } @else {
                    <video
                      #videoPlayer
                      [src]="mediaUrl(currentLesson.videoUrl)"
                      [poster]="currentLesson.thumbnailUrl ? mediaUrl(currentLesson.thumbnailUrl) : ''"
                      preload="metadata"
                      playsinline
                      (loadedmetadata)="syncVideoState()"
                      (timeupdate)="syncVideoState()"
                      (play)="playing.set(true)"
                      (pause)="playing.set(false)"
                      (ended)="onVideoEnded()"
                    ></video>
                  }

                  <div class="video-brand" aria-hidden="true">
                    <span>KV</span>
                    <strong>Korvi</strong>
                  </div>
                </div>

                @if (trustedYoutubeEmbedUrl(currentLesson.videoUrl)) {
                  <div class="youtube-controls">
                    <span>Reproduccion desde YouTube</span>
                    <button mat-icon-button type="button" (click)="toggleFullscreen()" aria-label="Pantalla completa">
                      <mat-icon>fullscreen</mat-icon>
                    </button>
                  </div>
                } @else {
                  <div class="video-controls">
                    <button mat-icon-button type="button" (click)="togglePlayback()" [attr.aria-label]="playing() ? 'Pausar video' : 'Reproducir video'">
                      <mat-icon>{{ playing() ? 'pause' : 'play_arrow' }}</mat-icon>
                    </button>
                    <input
                      type="range"
                      min="0"
                      [max]="duration() || 0"
                      [value]="currentTime()"
                      (input)="seek($event)"
                      aria-label="Progreso del video"
                    />
                    <span>{{ formatTime(currentTime()) }} / {{ formatTime(duration()) }}</span>
                    <button mat-icon-button type="button" (click)="toggleMute()" [attr.aria-label]="muted() ? 'Activar sonido' : 'Silenciar video'">
                      <mat-icon>{{ muted() ? 'volume_off' : 'volume_up' }}</mat-icon>
                    </button>
                    <button mat-icon-button type="button" (click)="toggleFullscreen()" aria-label="Pantalla completa">
                      <mat-icon>fullscreen</mat-icon>
                    </button>
                  </div>
                }
              </div>
            } @else {
              <div class="text-cover">
                <mat-icon>article</mat-icon>
                <span>Leccion de lectura</span>
              </div>
            }
          </mat-card>

          <aside class="lesson-side-panel rs-panel">
            <mat-chip>{{ currentLesson.category }}</mat-chip>
            <h2>Avance de la leccion</h2>
            <mat-progress-bar mode="determinate" [value]="lessonProgress()"></mat-progress-bar>
            <div class="progress-label">
              <span>{{ lessonStatus() }}</span>
              <strong>{{ lessonProgress() }}%</strong>
            </div>
            <button mat-flat-button color="primary" type="button" (click)="completeLesson()" [disabled]="isCompleted()">
              <mat-icon>{{ isCompleted() ? 'check_circle' : 'task_alt' }}</mat-icon>
              {{ isCompleted() ? 'Completada' : 'Marcar como completada' }}
            </button>
          </aside>
        </section>

        <mat-card class="lesson-content">
          <mat-card-content>
            <span class="rs-eyebrow">Contenido</span>
            <h2>{{ currentLesson.title }}</h2>
            <div class="lesson-rich-content" [innerHTML]="lessonContent()"></div>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card>
          <mat-card-content>No se encontro la leccion solicitada.</mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styleUrls: ['./education-lesson.component.css'],
})
export class EducationLessonComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoShell') videoShell?: ElementRef<HTMLElement>;

  lesson = signal<Lesson | null>(null);
  progress = signal<LessonProgress | null>(null);
  playing = signal(false);
  muted = signal(false);
  duration = signal(0);
  currentTime = signal(0);
  lessonProgress = computed(() => {
    const progress = this.progress();
    if (!progress) return 0;
    return progress.completed ? 100 : progress.progressPercent;
  });
  isCompleted = computed(() => this.progress()?.completed ?? false);
  lessonStatus = computed(() => {
    if (this.isCompleted()) return 'Completada';
    return this.lessonProgress() > 0 ? 'En progreso' : 'Sin iniciar';
  });
  lessonContent = computed(() => this.normalizeContentMediaUrls(this.lesson()?.content ?? ''));
  private savingProgress = false;
  private lastSavedProgress = 0;
  private lastProgressSaveAt = 0;
  private readonly youtubeEmbedUrlCache = new Map<string, SafeResourceUrl | null>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly education: EducationService,
    private readonly sanitizer: DomSanitizer,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigateByUrl('/education');
      return;
    }

    this.education.lesson(id).subscribe({
      next: (lesson) => {
        this.lesson.set(lesson);
        this.loadProgress(lesson.id);
      },
      error: () => {
        this.toastr.error('La leccion no esta disponible.', 'No se pudo cargar');
        this.router.navigateByUrl('/education');
      },
    });
  }

  ngOnDestroy(): void {
    const currentLesson = this.lesson();
    if (currentLesson && !this.isCompleted() && this.videoProgressPercent() > this.lessonProgress()) {
      this.education.saveLessonProgress(currentLesson.id, this.videoProgressPercent()).subscribe();
    }
  }

  mediaUrl(url: string) {
    return url.startsWith('/uploads') ? `${API_URL.replace('/api', '')}${url}` : url;
  }

  trustedYoutubeEmbedUrl(url: string): SafeResourceUrl | null {
    if (this.youtubeEmbedUrlCache.has(url)) return this.youtubeEmbedUrlCache.get(url) ?? null;
    const embedUrl = this.youtubeEmbedUrl(url);
    const trustedUrl = embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
    this.youtubeEmbedUrlCache.set(url, trustedUrl);
    return trustedUrl;
  }

  togglePlayback() {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (video.paused) {
      video.play();
      return;
    }
    video.pause();
  }

  toggleMute() {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.muted.set(video.muted);
  }

  toggleFullscreen() {
    const shell = this.videoShell?.nativeElement;
    if (!shell) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    shell.requestFullscreen();
  }

  seek(event: Event) {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.currentTime = Number((event.target as HTMLInputElement).value);
    this.syncVideoState();
  }

  syncVideoState() {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.duration.set(Number.isFinite(video.duration) ? video.duration : 0);
    this.currentTime.set(video.currentTime || 0);
    this.playing.set(!video.paused);
    this.muted.set(video.muted);
    this.persistVideoProgress(false);
  }

  onVideoEnded() {
    this.playing.set(false);
    this.completeLesson();
  }

  onYoutubeLoaded() {
    const currentLesson = this.lesson();
    if (currentLesson && !this.isCompleted() && this.lessonProgress() < 25) {
      this.education.saveLessonProgress(currentLesson.id, 25).subscribe({
        next: (progress) => this.setProgress(progress),
      });
    }
  }

  completeLesson() {
    const currentLesson = this.lesson();
    if (!currentLesson || this.isCompleted()) return;

    this.education.completeLesson(currentLesson.id, 100).subscribe({
      next: (progress) => {
        this.progress.set(progress);
        this.toastr.success('Progreso guardado correctamente.', 'Leccion completada');
      },
      error: () => this.toastr.error('Intenta nuevamente.', 'No se pudo completar la leccion'),
    });
  }

  formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  private startLesson(id: string) {
    if (this.savingProgress) return;
    this.savingProgress = true;
    this.education.saveLessonProgress(id, 15).subscribe({
      next: (progress) => this.setProgress(progress),
      error: () => {
        this.savingProgress = false;
      },
      complete: () => {
        this.savingProgress = false;
      },
    });
  }

  private loadProgress(id: string) {
    this.education.myProgress().subscribe({
      next: (progressRows) => {
        const progress = progressRows.find((row) => row.lesson.id === id);
        if (progress) {
          this.setProgress(progress);
          return;
        }
        this.startLesson(id);
      },
      error: () => this.startLesson(id),
    });
  }

  private persistVideoProgress(force: boolean) {
    const currentLesson = this.lesson();
    if (!currentLesson || this.isCompleted()) return;
    const percent = this.videoProgressPercent();
    const now = Date.now();
    if (this.savingProgress) return;
    if (!force && percent < Math.max(this.lessonProgress(), this.lastSavedProgress) + 10) return;
    if (!force && now - this.lastProgressSaveAt < 8000) return;
    this.savingProgress = true;
    this.lastProgressSaveAt = now;
    this.education.saveLessonProgress(currentLesson.id, percent).subscribe({
      next: (progress) => this.setProgress(progress),
      error: () => {
        this.savingProgress = false;
      },
      complete: () => {
        this.savingProgress = false;
      },
    });
  }

  private videoProgressPercent() {
    const total = this.duration();
    if (!total) return this.lessonProgress();
    return Math.min(95, Math.max(15, Math.round((this.currentTime() / total) * 100)));
  }

  private setProgress(progress: LessonProgress) {
    this.progress.set(progress);
    this.lastSavedProgress = progress.completed ? 100 : progress.progressPercent;
  }

  private normalizeContentMediaUrls(content: string) {
    const apiHost = API_URL.replace('/api', '');
    return content
      .replace(/\/uploads\/education\/casco-ajuste\.svg/gi, '/uploads/education/casco-ajuste.jpg')
      .replace(/\/uploads\/education\/casco-checklist\.svg/gi, '/uploads/education/casco-checklist.jpg')
      .replace(/(<img\b[^>]*\bsrc=["'])\/uploads\//gi, `$1${apiHost}/uploads/`);
  }

  private youtubeEmbedUrl(url: string) {
    const videoId = this.youtubeVideoId(url);
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1` : null;
  }

  private youtubeVideoId(url: string) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') return this.validYoutubeId(parsed.pathname.slice(1));
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
        if (parsed.pathname === '/watch') return this.validYoutubeId(parsed.searchParams.get('v') ?? '');
        const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
        return match ? this.validYoutubeId(match[1]) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private validYoutubeId(id: string) {
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
}
