import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/auth.service';
import { reverseGeocodeKorviLocation } from '../../core/map.config';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

type AdministrativeDetails = {
  province?: string;
  municipality?: string;
};

const MUNICIPALITIES_BY_PROVINCE: Record<string, string[]> = {
  'Azua': ['Azua de Compostela', 'Estebania', 'Guayabal', 'Las Charcas', 'Las Yayas de Viajama', 'Padre Las Casas', 'Peralta', 'Pueblo Viejo', 'Sabana Yegua', 'Tábara Arriba'],
  'Baoruco': ['Neiba', 'Galván', 'Los Ríos', 'Tamayo', 'Villa Jaragua'],
  'Barahona': ['Santa Cruz de Barahona', 'Cabral', 'El Peñón', 'Enriquillo', 'Fundación', 'Jaquimeyes', 'La Ciénaga', 'Las Salinas', 'Paraíso', 'Polo', 'Vicente Noble'],
  'Dajabón': ['Dajabón', 'El Pino', 'Loma de Cabrera', 'Partido', 'Restauración'],
  'Distrito Nacional': ['Santo Domingo de Guzmán'],
  'Duarte': ['San Francisco de Macorís', 'Arenoso', 'Castillo', 'Eugenio María de Hostos', 'Las Guáranas', 'Pimentel', 'Villa Riva'],
  'El Seibo': ['Santa Cruz de El Seibo', 'Miches'],
  'Elías Piña': ['Comendador', 'Bánica', 'El Llano', 'Hondo Valle', 'Juan Santiago', 'Pedro Santana'],
  'Espaillat': ['Moca', 'Cayetano Germosén', 'Gaspar Hernández', 'Jamao al Norte'],
  'Hato Mayor': ['Hato Mayor del Rey', 'El Valle', 'Sabana de la Mar'],
  'Hermanas Mirabal': ['Salcedo', 'Tenares', 'Villa Tapia'],
  'Independencia': ['Jimaní', 'Cristóbal', 'Duvergé', 'La Descubierta', 'Mella', 'Postrer Río'],
  'La Altagracia': ['Higüey', 'San Rafael del Yuma'],
  'La Romana': ['La Romana', 'Guaymate', 'Villa Hermosa'],
  'La Vega': ['La Vega', 'Constanza', 'Jarabacoa', 'Jima Abajo'],
  'María Trinidad Sánchez': ['Nagua', 'Cabrera', 'El Factor', 'Río San Juan'],
  'Monseñor Nouel': ['Bonao', 'Maimón', 'Piedra Blanca'],
  'Monte Cristi': ['Monte Cristi', 'Castañuelas', 'Guayubín', 'Las Matas de Santa Cruz', 'Pepillo Salcedo', 'Villa Vásquez'],
  'Monte Plata': ['Monte Plata', 'Bayaguana', 'Peralvillo', 'Sabana Grande de Boyá', 'Yamasá'],
  'Pedernales': ['Pedernales', 'Oviedo'],
  'Peravia': ['Baní', 'Nizao'],
  'Puerto Plata': ['Puerto Plata', 'Altamira', 'Guananico', 'Imbert', 'Los Hidalgos', 'Luperón', 'Sosúa', 'Villa Isabela', 'Villa Montellano'],
  'Samaná': ['Santa Bárbara de Samaná', 'Las Terrenas', 'Sánchez'],
  'San Cristóbal': ['San Cristóbal', 'Bajos de Haina', 'Cambita Garabitos', 'Los Cacaos', 'Sabana Grande de Palenque', 'San Gregorio de Nigua', 'Villa Altagracia', 'Yaguate'],
  'San José de Ocoa': ['San José de Ocoa', 'Rancho Arriba', 'Sabana Larga'],
  'San Juan': ['San Juan de la Maguana', 'Bohechío', 'El Cercado', 'Juan de Herrera', 'Las Matas de Farfán', 'Vallejuelo'],
  'San Pedro de Macorís': ['San Pedro de Macorís', 'Consuelo', 'Guayacanes', 'Quisqueya', 'Ramón Santana', 'San José de Los Llanos'],
  'Sánchez Ramírez': ['Cotuí', 'Cevicos', 'Fantino', 'La Mata'],
  'Santiago': ['Santiago de los Caballeros', 'Bisonó', 'Jánico', 'Licey al Medio', 'Puñal', 'Sabana Iglesia', 'San José de las Matas', 'Tamboril', 'Villa González'],
  'Santiago Rodríguez': ['San Ignacio de Sabaneta', 'Los Almácigos', 'Monción'],
  'Santo Domingo': ['Santo Domingo Este', 'Santo Domingo Norte', 'Santo Domingo Oeste', 'Boca Chica', 'Los Alcarrizos', 'Pedro Brand', 'San Antonio de Guerra'],
  'Valverde': ['Mao', 'Esperanza', 'Laguna Salada'],
};


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <section class="auth-page">
      <div class="auth-shell">
      <mat-card class="auth-card register-card">
        <div class="brand-lockup">
          <img src="assets/brand/korvi-wordmark.svg" alt="KORVI" />
          <span>Smart Mobility Platform</span>
        </div>
        <mat-card-header>
          <mat-card-title>Crear cuenta ciudadana</mat-card-title>
          <mat-card-subtitle>Registra tu perfil para reportar zonas de riesgo y participar en educación vial.</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form class="rs-form-grid" [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Nombre completo</mat-label>
              <input matInput formControlName="fullName" />
              <mat-error *ngIf="form.controls.fullName.invalid">El nombre es requerido.</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Correo</mat-label>
              <input matInput formControlName="email" placeholder="correo@dominio.com" />
              <mat-error *ngIf="form.controls.email.invalid">Ingresa un correo valido.</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contrasena</mat-label>
              <input matInput [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" />
              <button mat-icon-button matSuffix type="button" [attr.aria-label]="passwordVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="passwordVisible.update(value => !value)">
                <mat-icon>{{ passwordVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="form.controls.password.invalid">La contrasena debe tener al menos 8 caracteres.</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirmar contrasena</mat-label>
              <input matInput [type]="confirmPasswordVisible() ? 'text' : 'password'" formControlName="confirmPassword" />
              <button mat-icon-button matSuffix type="button" [attr.aria-label]="confirmPasswordVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="confirmPasswordVisible.update(value => !value)">
                <mat-icon>{{ confirmPasswordVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="form.controls.confirmPassword.invalid || form.hasError('passwordMismatch')">Las contrasenas deben coincidir.</mat-error>
            </mat-form-field>

            <div class="location-helper">
              <mat-icon>{{ locating() ? 'sync' : 'my_location' }}</mat-icon>
              <span>{{ locationMessage() }}</span>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Tipo de usuario vial</mat-label>
              <mat-select formControlName="vehicleType">
                <mat-option value="Motocicleta">Motocicleta</mat-option>
                <mat-option value="Carro">Carro</mat-option>
                <mat-option value="Peaton">Peaton</mat-option>
                <mat-option value="Transporte publico">Transporte publico</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="register-actions">
              <button mat-flat-button color="primary" type="submit" [disabled]="loading() || locating()">Crear cuenta</button>
              <a routerLink="/login">Volver al login</a>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
      <aside class="auth-visual" aria-label="KORVI Smart Mobility Platform">
        <img src="assets/auth/korvi-mobility-city.svg" alt="" aria-hidden="true" />
        <div class="metric-card risk">
          <span>Perfil</span>
          <strong>Ciudadano</strong>
        </div>
        <div class="metric-card mobility">
          <span>Movilidad</span>
          <strong>KORVI Drive</strong>
        </div>
      </aside>
      </div>
    </section>
  `,
  styleUrls: ['./auth-flow.component.css', './register.component.css'],
})
export class RegisterComponent {
  loading = signal(false);
  locating = signal(false);
  locationMessage = signal('Al crear la cuenta intentaremos detectar tu provincia y municipio automaticamente. Luego podras cambiarlos desde tu perfil.');
  passwordVisible = signal(false);
  confirmPasswordVisible = signal(false);
  readonly provinces = Object.keys(MUNICIPALITIES_BY_PROVINCE);
  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    province: [''],
    municipality: [''],
    vehicleType: ['Motocicleta'],
  }, { validators: passwordMatchValidator });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastr: ToastrService,
  ) {}

  municipalityOptions(): string[] {
    return MUNICIPALITIES_BY_PROVINCE[this.form.controls.province.value] ?? [];
  }

  onProvinceChange(province: string) {
    const municipalities = MUNICIPALITIES_BY_PROVINCE[province] ?? [];
    const current = this.form.controls.municipality.value;
    if (!municipalities.includes(current)) {
      this.form.controls.municipality.setValue(municipalities[0] ?? '');
    }
  }

  private detectLocationForRegistration(): Promise<AdministrativeDetails> {
    if (!navigator.geolocation) {
      this.locationMessage.set('Tu navegador no soporta geolocalizacion. Podras completar provincia y municipio desde tu perfil.');
      return Promise.resolve({});
    }

    this.locating.set(true);
    this.locationMessage.set('Solicitando ubicacion del dispositivo...');

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const details = await this.reverseGeocodeLocation(latitude, longitude);
          const normalized = this.normalizeDominicanLocation(details, latitude, longitude);
          this.applyAdministrativeSelection(normalized);
          this.locationMessage.set(
            normalized.province && normalized.municipality
              ? `Ubicacion detectada: ${normalized.province} - ${normalized.municipality}. Podras cambiarla desde tu perfil.`
              : 'No pudimos detectar provincia/municipio. Podras completarlos desde tu perfil.',
          );
          this.locating.set(false);
          resolve(normalized);
        },
        () => {
          this.locationMessage.set('Permiso de ubicacion no concedido. Podras completar provincia y municipio desde tu perfil.');
          this.locating.set(false);
          resolve({});
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
      );
    });
  }

  private applyAdministrativeSelection(details: AdministrativeDetails) {
    if (!details.province || !MUNICIPALITIES_BY_PROVINCE[details.province]) return;

    const municipalities = MUNICIPALITIES_BY_PROVINCE[details.province];
    const municipality = details.municipality && municipalities.includes(details.municipality)
      ? details.municipality
      : municipalities[0];

    this.form.patchValue({
      province: details.province,
      municipality,
    });
  }

  private async reverseGeocodeLocation(latitude: number, longitude: number): Promise<AdministrativeDetails> {
    try {
      const details = await reverseGeocodeKorviLocation(latitude, longitude);
      return {
        province: this.cleanAdministrativeName(details.province),
        municipality: this.cleanAdministrativeName(details.municipality),
      };
    } catch {
      return {};
    }
  }

  private normalizeDominicanLocation(details: AdministrativeDetails, latitude: number, longitude: number): AdministrativeDetails {
    const province = this.matchProvince(details.province);
    const municipality = this.matchMunicipality(province, details.municipality);
    const isSantoDomingoEsteArea = latitude >= 18.43 && latitude <= 18.58 && longitude >= -69.91 && longitude <= -69.75;

    if (isSantoDomingoEsteArea && (!municipality || municipality === 'Santo Domingo de Guzmán' || municipality === 'Santo Domingo')) {
      return { province: 'Santo Domingo', municipality: 'Santo Domingo Este' };
    }

    return { province, municipality };
  }

  private matchProvince(value: string | undefined): string | undefined {
    const normalized = this.normalizeText(value);
    if (!normalized) return undefined;
    return this.provinces.find((province) => this.normalizeText(province) === normalized);
  }

  private matchMunicipality(province: string | undefined, value: string | undefined): string | undefined {
    const normalized = this.normalizeText(value);
    if (!province || !normalized) return undefined;
    return MUNICIPALITIES_BY_PROVINCE[province]?.find((municipality) => this.normalizeText(municipality) === normalized);
  }

  private cleanAdministrativeName(value: string | undefined): string | undefined {
    return value?.replace(/^Provincia\s+/i, '').replace(/^Municipio\s+/i, '').trim() || undefined;
  }

  private normalizeText(value: string | undefined): string {
    return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error('Completa los campos requeridos y verifica que las contrasenas coincidan.', 'Registro incompleto');
      return;
    }
    this.loading.set(true);
    await this.detectLocationForRegistration();
    const { confirmPassword: _confirmPassword, ...payload } = this.form.getRawValue();
    this.auth.register(payload).subscribe({
      next: (response) => {
        this.toastr.success(response.message || 'Cuenta creada. Revisa tu correo.', 'Registro completado');
        this.router.navigate(['/activate-account'], { queryParams: { email: response.email } });
      },
      error: () => {
        this.toastr.error('Revisa los datos o intenta nuevamente.', 'No se pudo registrar el usuario');
        this.loading.set(false);
      },
    });
  }
}
