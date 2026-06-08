import { Component, OnInit, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastrService } from 'ngx-toastr';
import { API_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth.service';
import { reportCategoryLabel } from '../../core/reports.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    NgClass,
  ],
  template: `
    <section class="account-page">
      @if (!editing()) {
        <mat-card class="account-hero">
          <button class="hero-edit-button" mat-flat-button color="primary" type="button" (click)="startEditing()">
            <mat-icon>edit</mat-icon>
            Editar perfil
          </button>

          <div class="hero-user">
            <div class="avatar" [class.has-photo]="avatarImageUrl()" [ngClass]="avatarClass()">
              @if (avatarImageUrl()) {
                <img [src]="avatarImageUrl() ?? ''" alt="" />
              } @else {
                <span class="cartoon-avatar" aria-hidden="true">
                  <span class="cartoon-hair"></span>
                  <span class="cartoon-face-shape">
                    <span class="cartoon-eye left"></span>
                    <span class="cartoon-eye right"></span>
                    <span class="cartoon-nose"></span>
                    <span class="cartoon-mouth"></span>
                  </span>
                </span>
              }
            </div>
            <div>
              <strong>{{ user()?.fullName || 'Usuario' }}</strong>
              <span>{{ user()?.email || 'Correo no disponible' }}</span>
            </div>
          </div>
        </mat-card>

        <section class="controls-section">
          <h2>Resumen de cuenta</h2>
          <div class="controls-grid">
            <article class="control-tile success">
              <mat-icon>verified_user</mat-icon>
              <div>
                <strong>{{ roleLabel }}</strong>
                <span>Tipo de usuario dentro de la plataforma</span>
              </div>
              <mat-icon class="end-icon">chevron_right</mat-icon>
            </article>

            <article class="control-tile warning">
              <mat-icon>analytics</mat-icon>
              <div>
                <strong>{{ profileCompletion() }}% completo</strong>
                <span>Más datos mejoran priorización y análisis territorial</span>
              </div>
              <mat-icon class="end-icon">chevron_right</mat-icon>
            </article>
          </div>
        </section>

        <section class="controls-section">
          <h2>Preferencias del perfil</h2>
          <div class="controls-grid">
            <article class="control-tile blue">
              <mat-icon>notifications</mat-icon>
              <div>
                <strong>Notificaciones</strong>
                <span>Recibir alertas sobre reportes, validaciones y novedades</span>
              </div>
              <span class="setting-value">{{ notificationsStatusLabel() }}</span>
            </article>

            <article class="control-tile purple">
              <mat-icon>insights</mat-icon>
              <div>
                <strong>Uso para decisiones</strong>
                <span>Permitir usar datos agregados del perfil para analítica</span>
              </div>
              <span class="setting-value">{{ decisionInsightsStatusLabel() }}</span>
            </article>
          </div>
        </section>

        <section class="activity-layout">
          <mat-card class="activity-card">
            <div class="section-heading compact">
              <div>
                <h2>Contribuciones del usuario</h2>
                <p>Reportes enviados y estado operativo de sus aportes.</p>
              </div>
            </div>

            <div class="status-grid">
              <div><span>Pendientes</span><strong>{{ contributions().pendingReports }}</strong></div>
              <div><span>Validados</span><strong>{{ contributions().validatedReports }}</strong></div>
              <div><span>En proceso</span><strong>{{ contributions().inProgressReports }}</strong></div>
              <div><span>Resueltos</span><strong>{{ contributions().resolvedReports }}</strong></div>
            </div>

            <div class="activity-list">
              @for (report of contributions().recentReports; track report.id) {
                <article>
                  <mat-icon>report_problem</mat-icon>
                  <div>
                    <strong>{{ report.title }}</strong>
                    <span>{{ categoryLabel(report.category) }} | Riesgo {{ report.riskLevel }}/5 | {{ report.status }}</span>
                  </div>
                </article>
              } @empty {
                <p class="empty-text">Este usuario aún no tiene reportes registrados.</p>
              }
            </div>
          </mat-card>

          <mat-card class="activity-card">
            <div class="section-heading compact">
              <div>
                <h2>Educación vial</h2>
                <p>Progreso educativo y puntos acumulados.</p>
              </div>
              <mat-chip>{{ education().averageScore }} promedio</mat-chip>
            </div>

            <div class="status-grid education">
              <div><span>Puntos</span><strong>{{ education().points }}</strong></div>
              <div><span>Completadas</span><strong>{{ education().completedLessons }}</strong></div>
              <div><span>En progreso</span><strong>{{ education().lessonsInProgress }}</strong></div>
              <div><span>Promedio</span><strong>{{ education().averageScore }}</strong></div>
            </div>

            <div class="activity-list">
              @for (progress of education().recentProgress; track progress.id) {
                <article>
                  <mat-icon>{{ progress.completed ? 'check_circle' : 'play_circle' }}</mat-icon>
                  <div>
                    <strong>{{ progress.lessonTitle || 'Lección' }}</strong>
                    <span>{{ progress.progressPercent }}% | {{ progress.completed ? (progress.points + ' puntos') : 'En progreso' }}</span>
                  </div>
                </article>
              } @empty {
                <p class="empty-text">No hay progreso educativo registrado.</p>
              }
            </div>
          </mat-card>
        </section>
      } @else {
        <mat-card class="edit-hero">
          <button mat-stroked-button type="button" (click)="cancelEditing()">
            <mat-icon>arrow_back</mat-icon>
            Volver al perfil
          </button>

          <div>
            <span class="rs-eyebrow">Editar perfil</span>
            <h1>Información del usuario</h1>
            <p>Actualiza datos opcionales que ayudan a tomar mejores decisiones de seguridad vial.</p>
          </div>

          <button mat-flat-button color="primary" type="button" (click)="saveProfile()" [disabled]="form.invalid || saving()">
            <mat-icon>save</mat-icon>
            {{ saving() ? 'Guardando' : 'Guardar cambios' }}
          </button>
        </mat-card>

        <form class="profile-form editing" [formGroup]="form" (ngSubmit)="saveProfile()">
          <mat-card class="form-card">
            <div class="section-heading">
              <div>
                <h2>Avatar del perfil</h2>
                <p>Usa una foto o elige un diseño generado. Siempre tendrás uno por defecto.</p>
              </div>
            </div>

            <div class="avatar-editor">
              <div class="avatar-preview" [class.has-photo]="avatarImageUrl()" [ngClass]="avatarClass()">
                @if (avatarImageUrl()) {
                  <img [src]="avatarImageUrl() ?? ''" alt="" />
                } @else {
                  <span class="cartoon-avatar" aria-hidden="true">
                    <span class="cartoon-hair"></span>
                    <span class="cartoon-face-shape">
                      <span class="cartoon-eye left"></span>
                      <span class="cartoon-eye right"></span>
                      <span class="cartoon-nose"></span>
                      <span class="cartoon-mouth"></span>
                    </span>
                  </span>
                }
              </div>

              <div class="avatar-actions">
                <label class="upload-button">
                  <mat-icon>photo_camera</mat-icon>
                  Cargar foto
                  <input type="file" accept="image/png,image/jpeg,image/webp" (change)="uploadAvatar($event)" />
                </label>
                <span>JPG, PNG o WebP. Máximo 3 MB.</span>
              </div>
            </div>

            <div class="avatar-presets" aria-label="Diseños de avatar">
              @for (preset of avatarPresets; track preset.id) {
                <button
                  type="button"
                  class="avatar-choice"
                  [class.selected]="selectedAvatarPreset() === preset.id"
                  (click)="selectAvatarPreset(preset.id)"
                  [attr.aria-label]="'Seleccionar avatar ' + preset.label">
                  <span class="avatar-choice-preview" [ngClass]="preset.className">
                    <span class="cartoon-avatar" aria-hidden="true">
                      <span class="cartoon-hair"></span>
                      <span class="cartoon-face-shape">
                        <span class="cartoon-eye left"></span>
                        <span class="cartoon-eye right"></span>
                        <span class="cartoon-nose"></span>
                        <span class="cartoon-mouth"></span>
                      </span>
                    </span>
                  </span>
                  <strong>{{ preset.label }}</strong>
                </button>
              }
            </div>
          </mat-card>

          <mat-card class="form-card">
            <div class="section-heading">
              <div>
                <h2>Datos personales</h2>
                <p>Estos campos son opcionales salvo el nombre. Ayudan a entender patrones de movilidad.</p>
              </div>
            </div>

            <div class="field-grid">
              <mat-form-field appearance="outline">
                <mat-label>Nombre completo</mat-label>
                <input matInput formControlName="fullName" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Teléfono</mat-label>
                <input matInput formControlName="phone" placeholder="809-000-0000" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Provincia</mat-label>
                <input matInput formControlName="province" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Municipio</mat-label>
                <input matInput formControlName="municipality" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Ocupación</mat-label>
                <input matInput formControlName="occupation" placeholder="Ej. estudiante, conductor, repartidor" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tipo de vehículo</mat-label>
                <input matInput formControlName="vehicleType" placeholder="Ej. carro, motocicleta, bicicleta" />
              </mat-form-field>
            </div>
          </mat-card>

          <mat-card class="form-card">
            <div class="section-heading compact">
              <div>
                <h2>Movilidad y contacto</h2>
                <p>Información útil para segmentar riesgos, alertas y acciones preventivas.</p>
              </div>
            </div>

            <div class="field-grid">
              <mat-form-field appearance="outline">
                <mat-label>Modo principal de movilidad</mat-label>
                <mat-select formControlName="mobilityMode">
                  <mat-option value="">No especificado</mat-option>
                  @for (option of mobilityOptions; track option) {
                    <mat-option [value]="option">{{ option }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Frecuencia de conducción</mat-label>
                <mat-select formControlName="drivingFrequency">
                  <mat-option value="">No especificado</mat-option>
                  @for (option of frequencyOptions; track option) {
                    <mat-option [value]="option">{{ option }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Canal preferido</mat-label>
                <mat-select formControlName="preferredContactChannel">
                  <mat-option value="">No especificado</mat-option>
                  @for (option of contactOptions; track option) {
                    <mat-option [value]="option">{{ option }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Contacto de emergencia</mat-label>
                <input matInput formControlName="emergencyContactName" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Teléfono de emergencia</mat-label>
                <input matInput formControlName="emergencyContactPhone" />
              </mat-form-field>
            </div>
          </mat-card>

          <mat-card class="form-card">
            <div class="section-heading compact">
              <div>
                <h2>Preferencias</h2>
                <p>Controla alertas y consentimiento para analítica agregada.</p>
              </div>
            </div>

            <div class="toggle-grid">
              <article>
                <div>
                  <strong>Notificaciones</strong>
                  <span>Recibir alertas sobre reportes, validaciones y novedades.</span>
                </div>
                <mat-slide-toggle formControlName="notificationsEnabled" aria-label="Notificaciones"></mat-slide-toggle>
              </article>

              <article>
                <div>
                  <strong>Uso para decisiones</strong>
                  <span>Permitir usar datos agregados del perfil para análisis institucional.</span>
                </div>
                <mat-slide-toggle formControlName="decisionInsightsConsent" aria-label="Uso para decisiones"></mat-slide-toggle>
              </article>
            </div>
          </mat-card>

          <div class="form-actions">
            <button mat-stroked-button type="button" (click)="cancelEditing()">Cancelar</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon>
              {{ saving() ? 'Guardando' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styleUrls: ['./user-profile.component.css'],
})
export class UserProfileComponent implements OnInit {
  saving = signal(false);
  editing = signal(false);
  user = computed(() => this.auth.user());
  contributions = computed(() => this.user()?.contributions ?? {
    totalReports: 0,
    pendingReports: 0,
    validatedReports: 0,
    inProgressReports: 0,
    resolvedReports: 0,
    rejectedReports: 0,
    duplicateReports: 0,
    highRiskReports: 0,
    recentReports: [],
  });
  education = computed(() => this.user()?.education ?? {
    points: 0,
    completedLessons: 0,
    lessonsInProgress: 0,
    averageScore: 0,
    recentProgress: [],
  });

  readonly mobilityOptions = ['Carro', 'Motocicleta', 'Bicicleta', 'Transporte público', 'Caminando', 'Mixto'];
  readonly frequencyOptions = ['Diario', 'Varias veces por semana', 'Semanal', 'Ocasional'];
  readonly contactOptions = ['Email', 'Teléfono', 'WhatsApp', 'Notificación en app'];
  readonly avatarPresets = [
    { id: 'default', label: 'Clásico', className: 'avatar-preset-default' },
    { id: 'teal', label: 'Comunitario', className: 'avatar-preset-teal' },
    { id: 'navy', label: 'Operativo', className: 'avatar-preset-navy' },
    { id: 'gold', label: 'Preventivo', className: 'avatar-preset-gold' },
    { id: 'red', label: 'Alerta', className: 'avatar-preset-red' },
    { id: 'purple', label: 'Analítico', className: 'avatar-preset-purple' },
  ];

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    phone: ['', [Validators.maxLength(30)]],
    province: ['', [Validators.maxLength(80)]],
    municipality: ['', [Validators.maxLength(80)]],
    occupation: ['', [Validators.maxLength(100)]],
    vehicleType: ['', [Validators.maxLength(80)]],
    mobilityMode: [''],
    drivingFrequency: [''],
    emergencyContactName: ['', [Validators.maxLength(120)]],
    emergencyContactPhone: ['', [Validators.maxLength(30)]],
    preferredContactChannel: [''],
    avatarPreset: ['default'],
    notificationsEnabled: [true],
    decisionInsightsConsent: [false],
  });

  constructor(
    public readonly auth: AuthService,
    private readonly fb: FormBuilder,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit() {
    this.patchForm();
    this.setFormAccess();
    this.refreshProfile();
  }

  saveProfile() {
    if (!this.editing() || this.form.invalid) return;

    this.saving.set(true);
    const value = this.form.getRawValue();
    this.auth.updateProfile({
      fullName: value.fullName ?? '',
      phone: value.phone ?? '',
      province: value.province ?? '',
      municipality: value.municipality ?? '',
      occupation: value.occupation ?? '',
      vehicleType: value.vehicleType ?? '',
      mobilityMode: value.mobilityMode ?? '',
      drivingFrequency: value.drivingFrequency ?? '',
      emergencyContactName: value.emergencyContactName ?? '',
      emergencyContactPhone: value.emergencyContactPhone ?? '',
      preferredContactChannel: value.preferredContactChannel ?? '',
      avatarPreset: value.avatarPreset ?? 'default',
      notificationsEnabled: Boolean(value.notificationsEnabled),
      decisionInsightsConsent: Boolean(value.decisionInsightsConsent),
    }).subscribe({
      next: () => {
        this.patchForm();
        this.editing.set(false);
        this.setFormAccess();
        this.toastr.success('Perfil actualizado correctamente.', 'Mi perfil');
        this.saving.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo actualizar el perfil.', 'Mi perfil');
        this.saving.set(false);
      },
    });
  }

  refreshProfile() {
    this.auth.refreshUser().subscribe((user) => {
      if (user) {
        this.patchForm();
        this.setFormAccess();
      }
    });
  }

  startEditing() {
    this.editing.set(true);
    this.setFormAccess();
  }

  cancelEditing() {
    this.patchForm();
    this.editing.set(false);
    this.setFormAccess();
  }

  profileCompletion(): number {
    const user = this.auth.user();
    if (!user) return 0;
    const fields = [
      user.fullName,
      user.email,
      user.phone,
      user.province,
      user.municipality,
      user.occupation,
      user.vehicleType,
      user.mobilityMode,
      user.drivingFrequency,
      user.preferredContactChannel,
      user.emergencyContactName,
      user.emergencyContactPhone,
    ];
    const completed = fields.filter((value) => Boolean(String(value ?? '').trim())).length;
    return Math.round((completed / fields.length) * 100);
  }

  categoryLabel(category: string): string {
    return reportCategoryLabel(category);
  }

  uploadAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      this.toastr.warning('Selecciona una imagen JPG, PNG o WebP de hasta 3 MB.', 'Avatar');
      return;
    }

    this.saving.set(true);
    this.auth.uploadAvatar(file).subscribe({
      next: () => {
        this.form.controls.avatarPreset.setValue('photo', { emitEvent: false });
        this.toastr.success('Foto de perfil actualizada.', 'Avatar');
        this.saving.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo cargar la foto de perfil.', 'Avatar');
        this.saving.set(false);
      },
    });
  }

  selectAvatarPreset(preset: string) {
    this.form.controls.avatarPreset.setValue(preset);
  }

  selectedAvatarPreset(): string {
    return this.form.controls.avatarPreset.value || this.auth.user()?.avatarPreset || 'default';
  }

  avatarImageUrl(): string | null {
    const user = this.auth.user();
    const avatarUrl = user?.avatarUrl;
    if (!avatarUrl || this.selectedAvatarPreset() !== 'photo') return null;
    return avatarUrl.startsWith('/uploads') ? `${API_URL.replace('/api', '')}${avatarUrl}` : avatarUrl;
  }

  avatarClass(): string {
    const preset = this.selectedAvatarPreset();
    return preset === 'photo' ? 'avatar-preset-default' : `avatar-preset-${preset || 'default'}`;
  }

  notificationsStatusLabel(): string {
    return this.profileFlag('notificationsEnabled', true) ? 'Activas' : 'Desactivadas';
  }

  decisionInsightsStatusLabel(): string {
    return this.profileFlag('decisionInsightsConsent', false) ? 'Permitido' : 'No permitido';
  }

  private patchForm() {
    const user = this.auth.user();
    if (!user) return;
    this.form.patchValue({
      fullName: user.fullName ?? '',
      phone: user.phone ?? '',
      province: user.province ?? '',
      municipality: user.municipality ?? '',
      occupation: user.occupation ?? '',
      vehicleType: user.vehicleType ?? '',
      mobilityMode: user.mobilityMode ?? '',
      drivingFrequency: user.drivingFrequency ?? '',
      emergencyContactName: user.emergencyContactName ?? '',
      emergencyContactPhone: user.emergencyContactPhone ?? '',
      preferredContactChannel: user.preferredContactChannel ?? '',
      avatarPreset: user.avatarPreset ?? 'default',
      notificationsEnabled: this.profileFlag('notificationsEnabled', true),
      decisionInsightsConsent: this.profileFlag('decisionInsightsConsent', false),
    }, { emitEvent: false });
  }

  private profileFlag(key: 'notificationsEnabled' | 'decisionInsightsConsent', fallback: boolean): boolean {
    const profile = this.auth.user() as (Record<string, unknown> | null);
    const value = profile?.[key];
    return typeof value === 'boolean' ? value : fallback;
  }

  private setFormAccess() {
    if (this.editing()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }

  get initials() {
    const name = this.auth.user()?.fullName ?? 'Usuario';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  get roleLabel() {
    const role = this.auth.user()?.role ?? 'CITIZEN';
    const labels: Record<string, string> = {
      CITIZEN: 'Ciudadano',
      MODERATOR: 'Moderador',
      INSTITUTION_ADMIN: 'Administrador institucional',
      INSURANCE_ADMIN: 'Administrador aseguradora',
      SUPER_ADMIN: 'Super administrador',
    };
    return labels[role] ?? role;
  }
}
