import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { API_URL } from '../../core/api.config';
import { EducationCategory, EducationService, Lesson, YoutubeVideoMetadata } from '../../core/education.service';

@Component({
  selector: 'app-admin-education',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatPaginatorModule, MatSelectModule],
  template: `
    <section class="education-admin-page">
      <header class="admin-header">
        <div>
          <span class="rs-eyebrow">Contenido educativo</span>
          <h1>Registro de cursos y videos</h1>
          <p>Administra módulos preventivos, videos formativos y puntaje para la academia vial.</p>
        </div>
        <a mat-stroked-button routerLink="/admin">
          <mat-icon>arrow_back</mat-icon>
          Volver al panel
        </a>
      </header>

      <section class="admin-layout">
        <mat-card class="creator-panel">
          <div class="panel-heading">
            <div>
              <span>{{ editingLesson() ? 'Editando contenido' : 'Nuevo contenido' }}</span>
              <strong>{{ editingLesson() ? 'Actualizar curso o video' : 'Curso o video' }}</strong>
            </div>
            <mat-icon>video_library</mat-icon>
          </div>

          <form class="creator-form" [formGroup]="courseForm" (ngSubmit)="createLesson()">
            <div class="form-row two">
              <mat-form-field appearance="outline">
                <mat-label>Curso</mat-label>
                <input matInput formControlName="courseTitle" placeholder="Seguridad vial urbana" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Categoría</mat-label>
                <mat-select formControlName="category">
                  @for (category of categories(); track category.name) {
                    <mat-option [value]="category.name">{{ category.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Título del módulo</mat-label>
              <input matInput formControlName="title" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Descripción</mat-label>
              <textarea matInput rows="4" formControlName="content"></textarea>
            </mat-form-field>

            <div class="wysiwyg-field">
              <label>Editor visual de contenido</label>
              <div class="editor-toolbar">
                <button mat-icon-button type="button" (click)="formatText('bold')" aria-label="Negrita"><mat-icon>format_bold</mat-icon></button>
                <button mat-icon-button type="button" (click)="formatText('italic')" aria-label="Italica"><mat-icon>format_italic</mat-icon></button>
                <button mat-icon-button type="button" (click)="formatText('insertUnorderedList')" aria-label="Lista"><mat-icon>format_list_bulleted</mat-icon></button>
                <button mat-icon-button type="button" (click)="formatBlock('H2')" aria-label="Titulo"><mat-icon>title</mat-icon></button>
                <button mat-icon-button type="button" (click)="formatBlock('P')" aria-label="Parrafo"><mat-icon>notes</mat-icon></button>
                <span></span>
                <input #contentImageInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="onContentImageSelected($event)" />
                <button mat-stroked-button type="button" (click)="contentImageInput.click()">
                  <mat-icon>add_photo_alternate</mat-icon>
                  Imagen
                </button>
              </div>
              <div
                #contentEditor
                class="wysiwyg-editor"
                contenteditable="true"
                (input)="syncEditorContent()"
                (blur)="syncEditorContent()"
              ></div>
            </div>

            <section class="media-studio">
              <header>
                <div>
                  <span>Estudio de video</span>
                  <strong>{{ activeMediaSource() === 'youtube' ? 'YouTube' : 'Video local' }}</strong>
                </div>
                <div class="media-source-switch">
                  <button type="button" [class.active]="activeMediaSource() === 'youtube'" (click)="selectMediaSource('youtube')">
                    <mat-icon>smart_display</mat-icon>
                    YouTube
                  </button>
                  <button type="button" [class.active]="activeMediaSource() === 'local'" (click)="selectMediaSource('local')">
                    <mat-icon>movie</mat-icon>
                    Local
                  </button>
                </div>
              </header>

              <div class="media-studio-grid">
                <div class="media-controls">
                  @if (activeMediaSource() === 'youtube') {
            <div class="form-row three">
              <mat-form-field appearance="outline">
                <mat-label>URL del video</mat-label>
                <input matInput formControlName="videoUrl" placeholder="https://www.youtube.com/watch?v=..." (blur)="loadYoutubeMetadataFromForm()" />
                <button mat-icon-button matSuffix type="button" [disabled]="youtubeMetadataLoading()" aria-label="Leer parametros de YouTube" (click)="loadYoutubeMetadataFromForm(true)">
                  <mat-icon>{{ youtubeMetadataLoading() ? 'sync' : 'smart_display' }}</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Minutos</mat-label>
                <input matInput type="number" min="1" formControlName="durationMinutes" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Puntos</mat-label>
                <input matInput type="number" min="0" formControlName="points" />
              </mat-form-field>
            </div>
                    <div class="youtube-actions">
                      <button
                        mat-stroked-button
                        type="button"
                        [disabled]="youtubeMetadataLoading() || !courseForm.controls.videoUrl.value.trim()"
                        (click)="loadYoutubeMetadataFromForm(true)">
                        <mat-icon>{{ youtubeMetadataLoading() ? 'sync' : 'travel_explore' }}</mat-icon>
                        {{ youtubeMetadataLoading() ? 'Solicitando informacion...' : 'Solicitar informacion del video' }}
                      </button>
                    </div>
                  }

            @if (youtubeMetadata(); as metadata) {
              <div class="youtube-metadata-card">
                @if (metadata.thumbnailUrl) {
                  <img [src]="metadata.thumbnailUrl" [alt]="metadata.title" />
                }
                <div>
                  <span>YouTube detectado</span>
                  <strong>{{ metadata.title }}</strong>
                  <small>
                    {{ metadata.authorName || metadata.providerName }}
                    @if (metadata.durationMinutes) {
                      · {{ metadata.durationMinutes }} min
                    }
                  </small>
                </div>
              </div>
            }

            @if (activeMediaSource() === 'local') {
            <div class="video-uploader">
              <div>
                <span>Video local</span>
                <strong>{{ selectedVideoName() || 'Sin archivo seleccionado' }}</strong>
                <small>MP4, WebM o MOV. Se lee duracion y se genera miniatura.</small>
              </div>
              <input #videoInput type="file" accept="video/mp4,video/webm,video/quicktime" hidden (change)="onVideoSelected($event)" />
              <button mat-stroked-button type="button" (click)="videoInput.click()">
                <mat-icon>upload_file</mat-icon>
                Cargar video
              </button>
            </div>
            }

            @if (thumbnailPreviewUrl()) {
              <figure class="thumbnail-preview">
                <img [src]="thumbnailPreviewUrl()" alt="Miniatura generada del video" />
                <figcaption>
                  <mat-icon>image</mat-icon>
                  Miniatura generada
                </figcaption>
              </figure>
            }

                  @if (activeMediaSource() === 'local') {
                    <div class="form-row three compact">
                      <mat-form-field appearance="outline">
                        <mat-label>Minutos</mat-label>
                        <input matInput type="number" min="1" formControlName="durationMinutes" />
                      </mat-form-field>

                      <mat-form-field appearance="outline">
                        <mat-label>Puntos</mat-label>
                        <input matInput type="number" min="0" formControlName="points" />
                      </mat-form-field>

                      <button mat-stroked-button type="button" class="clear-media-button" (click)="clearMedia()">
                        <mat-icon>backspace</mat-icon>
                        Limpiar medio
                      </button>
                    </div>
                  }
                </div>

                <div class="media-preview-panel">
                  @if (activeMediaSource() === 'youtube' && youtubeMetadata()?.url && trustedYoutubeEmbedUrl(youtubeMetadata()?.url || ''); as youtubeUrl) {
                    <iframe
                      [src]="youtubeUrl"
                      title="Vista previa YouTube"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                      referrerpolicy="strict-origin-when-cross-origin"
                    ></iframe>
                  } @else if (localVideoPreviewUrl()) {
                    <video [src]="localVideoPreviewUrl()" [poster]="thumbnailPreviewUrl()" controls playsinline></video>
                  } @else if (thumbnailPreviewUrl()) {
                    <img [src]="thumbnailPreviewUrl()" alt="Miniatura del video" />
                  } @else {
                    <div class="media-empty-preview">
                      <mat-icon>movie_creation</mat-icon>
                      <strong>Sin video seleccionado</strong>
                      <span>Pega una URL de YouTube o carga un archivo local.</span>
                    </div>
                  }

                  @if (thumbnailPreviewUrl()) {
                    <div class="media-preview-caption">
                      <mat-icon>image</mat-icon>
                      <span>Miniatura disponible</span>
                    </div>
                  }
                </div>
              </div>
            </section>

            <div class="creator-actions">
              <button mat-stroked-button type="button" (click)="resetForm()">{{ editingLesson() ? 'Cancelar' : 'Limpiar' }}</button>
              <button mat-flat-button color="primary" type="submit" [disabled]="courseForm.invalid || saving()">
                {{ editingLesson() ? 'Actualizar contenido' : 'Guardar contenido' }}
              </button>
            </div>
          </form>
        </mat-card>

        <mat-card class="content-list">
          <div class="panel-heading">
            <div>
              <span>Biblioteca</span>
              <strong>{{ lessons().length }} módulos registrados</strong>
            </div>
          </div>

          <div class="lesson-list">
            @for (lesson of pagedLessons(); track lesson.id) {
              <article [class.selected]="editingLesson()?.id === lesson.id">
                <div class="lesson-thumb">
                  @if (lesson.thumbnailUrl) {
                    <img [src]="mediaUrl(lesson.thumbnailUrl)" [alt]="lesson.title" />
                  } @else {
                    <mat-icon>{{ lesson.videoUrl ? 'play_circle' : 'article' }}</mat-icon>
                  }
                </div>

                <div class="lesson-body">
                  <div class="lesson-title-row">
                    <mat-chip>{{ lesson.courseTitle || lesson.category }}</mat-chip>
                    <span>{{ lesson.durationMinutes || 8 }} min - {{ lesson.points }} pts</span>
                  </div>
                  <h2>{{ lesson.title }}</h2>
                  <p>{{ lessonSummary(lesson.content) }}</p>
                  <div class="lesson-actions">
                    <span>{{ lesson.videoUrl ? 'Leccion en video' : 'Leccion de lectura' }}</span>
                    <button mat-icon-button class="lesson-menu-button" type="button" [matMenuTriggerFor]="lessonMenu" aria-label="Opciones de la leccion">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #lessonMenu="matMenu" xPosition="before" panelClass="entity-actions-menu">
                      @if (lesson.videoUrl) {
                        <button mat-menu-item type="button" (click)="openVideoPreview(lesson)">
                          <mat-icon>play_circle</mat-icon>
                          <span>Ver video</span>
                        </button>
                      }
                      <button mat-menu-item type="button" (click)="editLesson(lesson)">
                        <mat-icon>edit</mat-icon>
                        <span>Editar leccion</span>
                      </button>
                    </mat-menu>
                  </div>
                </div>
              </article>
            } @empty {
              <div class="empty-state">
                <mat-icon>video_library</mat-icon>
                <strong>No hay contenido registrado</strong>
                <span>Crea el primer curso o video para la academia vial.</span>
              </div>
            }
          </div>
        </mat-card>

        <mat-paginator
          [length]="lessons().length"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[5, 10, 20]"
          showFirstLastButtons
          (page)="onPage($event)">
        </mat-paginator>
      </section>

      @if (previewLesson(); as lesson) {
        <div class="video-modal-backdrop" (click)="closeVideoPreview()">
          <section class="video-modal" (click)="$event.stopPropagation()">
            <header>
              <div class="brand-mark">KV</div>
              <div>
                <span>Korvi</span>
                <strong>{{ lesson.title }}</strong>
              </div>
              <button mat-icon-button type="button" (click)="closeVideoPreview()" aria-label="Cerrar reproductor">
                <mat-icon>close</mat-icon>
              </button>
            </header>

            <div class="platform-player">
              @if (lesson.videoUrl && trustedYoutubeEmbedUrl(lesson.videoUrl); as youtubeUrl) {
                <iframe
                  class="youtube-preview"
                  [src]="youtubeUrl"
                  title="Video de YouTube"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
              } @else {
                <video
                  [src]="mediaUrl(lesson.videoUrl || '')"
                  [poster]="lesson.thumbnailUrl ? mediaUrl(lesson.thumbnailUrl) : ''"
                  controls
                  autoplay
                  playsinline
                ></video>
              }
              <div class="player-watermark">
                <span>Korvi</span>
              </div>
            </div>
          </section>
        </div>
      }
    </section>
  `,
  styleUrls: ['./admin-education.component.css'],
})
export class AdminEducationComponent implements OnInit {
  @ViewChild('contentEditor') contentEditor?: ElementRef<HTMLDivElement>;

  lessons = signal<Lesson[]>([]);
  pageIndex = signal(0);
  pageSize = signal(5);
  pagedLessons = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.lessons().slice(start, start + this.pageSize());
  });
  categories = signal<EducationCategory[]>([]);
  saving = signal(false);
  editingLesson = signal<Lesson | null>(null);
  previewLesson = signal<Lesson | null>(null);
  activeMediaSource = signal<'youtube' | 'local'>('youtube');
  selectedVideoName = signal('');
  thumbnailPreviewUrl = signal('');
  localVideoPreviewUrl = signal('');
  youtubeMetadata = signal<YoutubeVideoMetadata | null>(null);
  youtubeMetadataLoading = signal(false);
  private lastYoutubeMetadataUrl = '';
  private selectedVideoFile?: File;
  private thumbnailBlob?: Blob;
  private readonly youtubeEmbedUrlCache = new Map<string, SafeResourceUrl | null>();
  readonly defaultCourseForm = {
    courseTitle: 'Seguridad vial urbana',
    category: 'Conductores',
    title: '',
    content: '',
    videoUrl: '',
    durationMinutes: 8,
    points: 40,
  };
  courseForm = this.fb.nonNullable.group({
    courseTitle: [this.defaultCourseForm.courseTitle],
    category: [this.defaultCourseForm.category, Validators.required],
    title: [this.defaultCourseForm.title, Validators.required],
    content: [this.defaultCourseForm.content, Validators.required],
    videoUrl: [this.defaultCourseForm.videoUrl],
    durationMinutes: [this.defaultCourseForm.durationMinutes, [Validators.required, Validators.min(1)]],
    points: [this.defaultCourseForm.points, [Validators.required, Validators.min(0)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly education: EducationService,
    private readonly sanitizer: DomSanitizer,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
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
    this.education.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.categories.set([{ name: 'Conductores' }, { name: 'Motociclistas' }, { name: 'Prevencion' }]),
    });
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  createLesson() {
    if (this.courseForm.invalid) return;

    this.syncEditorContent();
    this.saving.set(true);
    const payload = this.courseForm.getRawValue();
    const request = this.selectedVideoFile ? this.createLessonFormData(payload) : {
      ...payload,
      videoUrl: this.youtubeMetadata()?.url ?? (payload.videoUrl || undefined),
      thumbnailUrl: this.youtubeMetadata()?.thumbnailUrl,
      durationMinutes: this.youtubeMetadata()?.durationMinutes ?? payload.durationMinutes,
    };
    const editing = this.editingLesson();
    const action = editing ? this.education.updateLesson(editing.id, request) : this.education.createLesson(request);

    action.subscribe({
      next: (lesson) => {
        this.lessons.update((current) => {
          if (!editing) return [...current, lesson];
          return current.map((item) => (item.id === lesson.id ? lesson : item));
        });
        this.clampPageIndex();
        this.resetForm();
        this.saving.set(false);
        this.toastr.success(
          editing ? 'Leccion actualizada correctamente.' : 'Curso o video registrado correctamente.',
          editing ? 'Contenido actualizado' : 'Contenido creado',
        );
      },
      error: () => {
        this.saving.set(false);
        this.toastr.error('Verifica permisos y datos del formulario.', 'No se pudo crear el contenido');
      },
    });
  }

  editLesson(lesson: Lesson) {
    this.revokeThumbnailPreview();
    this.editingLesson.set(lesson);
    this.selectedVideoFile = undefined;
    this.thumbnailBlob = undefined;
    this.selectedVideoName.set(lesson.videoUrl ? 'Video actual registrado' : '');
    this.thumbnailPreviewUrl.set(lesson.thumbnailUrl ? this.mediaUrl(lesson.thumbnailUrl) : '');
    this.localVideoPreviewUrl.set('');
    this.youtubeMetadata.set(null);
    this.lastYoutubeMetadataUrl = '';
    this.activeMediaSource.set(this.youtubeVideoId(lesson.videoUrl || '') ? 'youtube' : lesson.videoUrl ? 'local' : 'youtube');
    this.courseForm.reset({
      courseTitle: lesson.courseTitle || this.defaultCourseForm.courseTitle,
      category: lesson.category,
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.videoUrl || '',
      durationMinutes: lesson.durationMinutes || this.defaultCourseForm.durationMinutes,
      points: lesson.points ?? this.defaultCourseForm.points,
    });
    this.setEditorContent(lesson.content);
  }

  onVideoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.revokeThumbnailPreview();
    this.revokeLocalVideoPreview();
    this.selectedVideoFile = file;
    this.localVideoPreviewUrl.set(URL.createObjectURL(file));
    this.youtubeMetadata.set(null);
    this.lastYoutubeMetadataUrl = '';
    this.selectedVideoName.set(file.name);
    this.generateVideoThumbnail(file).catch(() => {
      this.thumbnailBlob = undefined;
      this.thumbnailPreviewUrl.set('');
      this.toastr.warning('El video se cargara sin miniatura.', 'No se pudo generar miniatura');
    });
  }

  selectMediaSource(source: 'youtube' | 'local') {
    this.activeMediaSource.set(source);
    if (source === 'youtube') {
      this.selectedVideoFile = undefined;
      this.selectedVideoName.set('');
      this.revokeLocalVideoPreview();
      return;
    }

    this.courseForm.controls.videoUrl.setValue('');
    this.youtubeMetadata.set(null);
    this.lastYoutubeMetadataUrl = '';
  }

  clearMedia() {
    this.selectedVideoFile = undefined;
    this.selectedVideoName.set('');
    this.thumbnailBlob = undefined;
    this.youtubeMetadata.set(null);
    this.lastYoutubeMetadataUrl = '';
    this.courseForm.controls.videoUrl.setValue('');
    this.revokeThumbnailPreview();
    this.revokeLocalVideoPreview();
  }

  loadYoutubeMetadataFromForm(force = false) {
    const url = this.courseForm.controls.videoUrl.value.trim();
    if (!url || this.selectedVideoFile) return;
    if (!force && url === this.lastYoutubeMetadataUrl) return;
    if (!this.youtubeVideoId(url)) {
      this.youtubeMetadata.set(null);
      this.lastYoutubeMetadataUrl = '';
      return;
    }

    this.youtubeMetadataLoading.set(true);
    this.education.youtubeMetadata(url).subscribe({
      next: (metadata) => {
        this.youtubeMetadata.set(metadata);
        this.lastYoutubeMetadataUrl = url;
        this.youtubeMetadataLoading.set(false);
        this.applyYoutubeMetadata(metadata, force);
        this.toastr.success('Titulo, descripcion, miniatura y duracion detectados.', 'YouTube');
      },
      error: () => {
        this.youtubeMetadataLoading.set(false);
        this.toastr.error('No se pudieron leer los parametros del video.', 'YouTube');
      },
    });
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

  openVideoPreview(lesson: Lesson) {
    this.previewLesson.set(lesson);
  }

  closeVideoPreview() {
    this.previewLesson.set(null);
  }

  formatText(command: string) {
    this.focusEditor();
    document.execCommand(command, false);
    this.syncEditorContent();
  }

  formatBlock(block: 'H2' | 'P') {
    this.focusEditor();
    document.execCommand('formatBlock', false, block);
    this.syncEditorContent();
  }

  onContentImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.education.uploadContentImage(file).subscribe({
      next: ({ url }) => {
        this.insertImage(this.mediaUrl(url));
        input.value = '';
      },
      error: () => this.toastr.error('Solo se permiten imagenes JPG, PNG o WebP de hasta 5 MB.', 'No se pudo cargar imagen'),
    });
  }

  syncEditorContent() {
    this.courseForm.controls.content.setValue(this.contentEditor?.nativeElement.innerHTML.trim() ?? '');
  }

  lessonSummary(content: string) {
    const element = document.createElement('div');
    element.innerHTML = content;
    const text = element.textContent?.trim() || '';
    return text.length > 150 ? `${text.slice(0, 150)}...` : text;
  }

  resetForm() {
    this.courseForm.reset(this.defaultCourseForm);
    this.setEditorContent(this.defaultCourseForm.content);
    this.editingLesson.set(null);
    this.selectedVideoFile = undefined;
    this.selectedVideoName.set('');
    this.thumbnailBlob = undefined;
    this.activeMediaSource.set('youtube');
    this.youtubeMetadata.set(null);
    this.lastYoutubeMetadataUrl = '';
    this.revokeThumbnailPreview();
    this.revokeLocalVideoPreview();
  }

  private applyYoutubeMetadata(metadata: YoutubeVideoMetadata, overwriteText = false) {
    if (overwriteText || !this.courseForm.controls.title.value.trim()) {
      this.courseForm.controls.title.setValue(metadata.title);
    }
    if (metadata.description?.trim() && (overwriteText || !this.courseForm.controls.content.value.trim())) {
      this.setEditorContent(this.youtubeDescriptionToHtml(metadata.description));
    }
    if (metadata.durationMinutes) {
      this.courseForm.controls.durationMinutes.setValue(metadata.durationMinutes);
    }
    this.courseForm.controls.videoUrl.setValue(metadata.url);
    if (metadata.thumbnailUrl) {
      this.revokeThumbnailPreview();
      this.thumbnailPreviewUrl.set(metadata.thumbnailUrl);
    }
  }

  private youtubeDescriptionToHtml(description: string) {
    const paragraphs = description
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => this.escapeHtml(paragraph.trim()).replace(/\n/g, '<br>'))
      .filter(Boolean);
    return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
  }

  private escapeHtml(value: string) {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
  }

  private createLessonFormData(payload: typeof this.defaultCourseForm) {
    const data = new FormData();
    data.append('courseTitle', payload.courseTitle);
    data.append('category', payload.category);
    data.append('title', payload.title);
    data.append('content', payload.content);
    data.append('durationMinutes', String(payload.durationMinutes));
    data.append('points', String(payload.points));
    if (payload.videoUrl) data.append('videoUrl', payload.videoUrl);
    if (this.editingLesson()?.thumbnailUrl) data.append('thumbnailUrl', this.editingLesson()?.thumbnailUrl ?? '');
    if (this.selectedVideoFile) data.append('video', this.selectedVideoFile, this.selectedVideoFile.name);
    if (this.thumbnailBlob) data.append('thumbnail', this.thumbnailBlob, `${this.selectedVideoFile?.name ?? 'video'}-thumbnail.webp`);
    return data;
  }

  private generateVideoThumbnail(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;

      const cleanup = () => URL.revokeObjectURL(objectUrl);
      video.onerror = () => {
        cleanup();
        reject();
      };
      video.onloadedmetadata = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          this.courseForm.controls.durationMinutes.setValue(Math.max(1, Math.ceil(video.duration / 60)));
        }
        video.currentTime = Math.min(1, Math.max(0, video.duration / 3 || 0));
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * canvas.width));
        const context = canvas.getContext('2d');
        if (!context) {
          cleanup();
          reject();
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          cleanup();
          if (!blob) {
            reject();
            return;
          }
          this.thumbnailBlob = blob;
          this.thumbnailPreviewUrl.set(URL.createObjectURL(blob));
          resolve();
        }, 'image/webp', 0.82);
      };
    });
  }

  private revokeThumbnailPreview() {
    const previewUrl = this.thumbnailPreviewUrl();
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    this.thumbnailPreviewUrl.set('');
  }

  private revokeLocalVideoPreview() {
    const previewUrl = this.localVideoPreviewUrl();
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    this.localVideoPreviewUrl.set('');
  }

  private focusEditor() {
    this.contentEditor?.nativeElement.focus();
  }

  private insertImage(url: string) {
    this.focusEditor();
    document.execCommand('insertImage', false, url);
    this.syncEditorContent();
  }

  private setEditorContent(content: string) {
    queueMicrotask(() => {
      if (!this.contentEditor) return;
      this.contentEditor.nativeElement.innerHTML = content || '';
      this.syncEditorContent();
    });
  }

  private clampPageIndex() {
    const maxPage = Math.max(Math.ceil(this.lessons().length / this.pageSize()) - 1, 0);
    if (this.pageIndex() > maxPage) this.pageIndex.set(maxPage);
  }

  private youtubeEmbedUrl(url: string) {
    const videoId = this.youtubeVideoId(url);
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1` : null;
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
