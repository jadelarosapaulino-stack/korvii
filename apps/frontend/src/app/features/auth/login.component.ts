import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, effect, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { AuthService, SocialAuthConfig } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { accessToken?: string }; status?: string }) => void,
        options?: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="auth-page">
      <div class="auth-shell">
        <mat-card class="auth-card login-card">
          <div class="brand-lockup">
            <img src="assets/brand/korvi-wordmark.svg" alt="KORVI" />
            <span>Smart Mobility Platform</span>
          </div>

          <mat-card-header>
            <mat-card-title>Inteligencia vial para decisiones seguras</mat-card-title>
            <mat-card-subtitle>Accede al centro operativo de reportes, riesgos, movilidad e instituciones.</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
              <div class="field-stack">
                <label class="auth-input-field" [class.invalid]="form.controls.email.invalid && form.controls.email.touched">
                  <span>Correo*</span>
                  <input formControlName="email" placeholder="ciudadano@demo.com" autocomplete="email" />
                  <small *ngIf="form.controls.email.invalid && form.controls.email.touched">Ingresa un correo valido.</small>
                </label>

                <label class="auth-input-field" [class.invalid]="form.controls.password.invalid && form.controls.password.touched">
                  <span>Contrasena*</span>
                  <div class="password-input-shell">
                    <input [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" placeholder="Demo12345" autocomplete="current-password" />
                    <button mat-icon-button type="button" [attr.aria-label]="passwordVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="passwordVisible.update(value => !value)">
                      <mat-icon>{{ passwordVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>
                  <small *ngIf="form.controls.password.invalid && form.controls.password.touched">La contrasena debe tener al menos 8 caracteres.</small>
                </label>
              </div>

              <div class="form-actions">
                <a routerLink="/forgot-password">Recuperar acceso</a>
                <a routerLink="/activate-account">Activar cuenta</a>
              </div>

              <div class="primary-actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading() || socialLoading()">Entrar</button>
                <a mat-stroked-button routerLink="/register">Crear cuenta</a>
              </div>

              @if (hasVisibleSocialProviders()) {
                <div class="social-login">
                  <div class="social-divider"><span>O entra con</span></div>
                  @if (socialConfig()?.google && socialConfig()?.googleClientId) {
                    <div #googleButtonContainer class="google-button"></div>
                  }
                  @if (socialConfig()?.facebook && socialConfig()?.facebookAppId) {
                    <button mat-stroked-button class="facebook-button" type="button" [disabled]="socialLoading() === 'facebook' || !facebookReady()" (click)="loginWithFacebook()">
                      <mat-icon>{{ socialLoading() === 'facebook' ? 'sync' : 'facebook' }}</mat-icon>
                      {{ socialLoading() === 'facebook' ? 'Conectando...' : 'Continuar con Facebook' }}
                    </button>
                  }
                </div>
              }
            </form>
          </mat-card-content>
        </mat-card>

        <aside class="auth-visual" aria-label="KORVI Smart Mobility Platform">
          <img src="assets/auth/korvi-mobility-city.svg" alt="" aria-hidden="true" />
          <div class="metric-card risk">
            <span>Riesgo activo</span>
            <strong>5/5</strong>
          </div>
          <div class="metric-card mobility">
            <span>Movilidad</span>
            <strong>Smart City</strong>
          </div>
        </aside>
      </div>
    </section>
  `,
  styleUrls: ['./auth-flow.component.css', './login.component.css'],
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('googleButtonContainer') private googleButtonContainer?: ElementRef<HTMLElement>;
  loading = signal(false);
  socialLoading = signal<'google' | 'facebook' | null>(null);
  passwordVisible = signal(false);
  socialConfig = signal<SocialAuthConfig | null>(null);
  googleButtonReady = signal(false);
  facebookReady = signal(false);
  form = this.fb.nonNullable.group({
    email: ['ciudadano@demo.com', [Validators.required, Validators.email]],
    password: ['Demo12345', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastr: ToastrService,
    public readonly i18n: I18nService,
  ) {
    effect(() => {
      this.i18n.language();
      this.googleButtonReady.set(false);
      this.googleButtonContainer?.nativeElement.replaceChildren();
      queueMicrotask(() => this.initializeSocialProviders());
    });
  }

  ngOnInit(): void {
    this.auth.socialAuthConfig().subscribe({
      next: (config) => {
        this.socialConfig.set(config);
        this.initializeSocialProviders();
      },
      error: () => this.socialConfig.set({ google: false, facebook: false }),
    });
  }

  ngAfterViewInit(): void {
    this.initializeSocialProviders();
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.afterLogin('Sesion iniciada correctamente.');
      },
      error: () => {
        this.toastr.error('Verifica tus credenciales o el estado del backend.', 'No se pudo iniciar sesion');
        this.loading.set(false);
      },
    });
  }

  loginWithFacebook() {
    const config = this.socialConfig();
    if (!config?.facebook || !config.facebookAppId || !this.facebookReady() || !window.FB) {
      this.toastr.error('Facebook no esta configurado para la version web.', 'Login social');
      return;
    }

    this.socialLoading.set('facebook');
    window.FB.login(
      (response) => {
        const token = response.authResponse?.accessToken;
        if (!token) {
          this.socialLoading.set(null);
          this.toastr.error('Facebook no devolvio un token valido.', 'Login social');
          return;
        }

        this.auth.socialLogin('facebook', token).subscribe({
          next: () => this.afterLogin('Sesion iniciada con Facebook.'),
          error: () => {
            this.socialLoading.set(null);
            this.toastr.error('No se pudo iniciar sesion con Facebook.', 'Login social');
          },
        });
      },
      { scope: 'email', return_scopes: true },
    );
  }

  hasVisibleSocialProviders(): boolean {
    const config = this.socialConfig();
    return Boolean((config?.google && config.googleClientId) || (config?.facebook && config.facebookAppId));
  }

  private initializeSocialProviders() {
    const config = this.socialConfig();
    if (!config) return;
    if (config.google && config.googleClientId) this.initializeGoogle(config.googleClientId);
    if (config.facebook && config.facebookAppId) this.initializeFacebook(config.facebookAppId);
  }

  private initializeGoogle(clientId: string) {
    const container = this.googleButtonContainer?.nativeElement;
    if (!container) return;

    this.loadScript('google-identity-services', 'https://accounts.google.com/gsi/client').then(() => {
      if (!window.google?.accounts?.id || this.googleButtonReady()) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this.handleGoogleCredential(response.credential),
      });
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        width: Math.min(424, container.clientWidth || 424),
        text: 'signin_with',
        locale: this.i18n.language() === 'en' ? 'en' : 'es',
      });
      this.googleButtonReady.set(true);
    }).catch(() => this.toastr.error('No se pudo cargar Google Sign-In.', 'Login social'));
  }

  private initializeFacebook(appId: string) {
    if (this.facebookReady()) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v20.0',
      });
      this.facebookReady.set(true);
    };

    const locale = this.i18n.language() === 'en' ? 'en_US' : 'es_LA';
    this.loadScript('facebook-jssdk', `https://connect.facebook.net/${locale}/sdk.js`).catch(() =>
      this.toastr.error('No se pudo cargar Facebook Login.', 'Login social'),
    );
  }

  private handleGoogleCredential(credential: string | undefined) {
    if (!credential) {
      this.toastr.error('Google no devolvio un token valido.', 'Login social');
      return;
    }

    this.socialLoading.set('google');
    this.auth.socialLogin('google', credential).subscribe({
      next: () => this.afterLogin('Sesion iniciada con Google.'),
      error: () => {
        this.socialLoading.set(null);
        this.toastr.error('No se pudo iniciar sesion con Google.', 'Login social');
      },
    });
  }

  private afterLogin(message: string) {
    this.toastr.success(message, 'Bienvenido');
    this.router.navigateByUrl(
      this.auth.user()?.mustChangePassword
        ? '/profile/change-password'
        : '/map',
    );
  }

  private loadScript(id: string, src: string): Promise<void> {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }
}
