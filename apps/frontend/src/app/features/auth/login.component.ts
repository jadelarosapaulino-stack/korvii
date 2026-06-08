import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
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
        <mat-card class="auth-card">
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
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Correo</mat-label>
                  <input matInput formControlName="email" placeholder="ciudadano@demo.com" />
                  <mat-error *ngIf="form.controls.email.invalid">Ingresa un correo valido.</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Contrasena</mat-label>
                  <input matInput [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" placeholder="Demo12345" />
                  <button mat-icon-button matSuffix type="button" [attr.aria-label]="passwordVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="passwordVisible.update(value => !value)">
                    <mat-icon>{{ passwordVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                  <mat-error *ngIf="form.controls.password.invalid">La contrasena debe tener al menos 8 caracteres.</mat-error>
                </mat-form-field>
              </div>

              <div class="form-actions">
                <a routerLink="/recuperar-contrasena">Recuperar acceso</a>
                <a routerLink="/activar-cuenta">Activar cuenta</a>
              </div>

              <div class="primary-actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading() || socialLoading()">Entrar</button>
                <a mat-stroked-button routerLink="/registro">Crear cuenta</a>
              </div>

              @if (socialConfig()?.google || socialConfig()?.facebook) {
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
  styleUrls: ['./login.component.css'],
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
  ) {}

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
        locale: 'es',
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

    this.loadScript('facebook-jssdk', 'https://connect.facebook.net/es_LA/sdk.js').catch(() =>
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
        ? '/perfil/cambiar-contrasena'
        : this.auth.canViewExecutivePanel()
          ? '/dashboard'
          : '/reportes',
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
