import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="auth-page">
      <div class="auth-shell">
        <mat-card class="auth-card">
          <div class="brand-lockup">
            <img src="assets/brand/korvi-wordmark.svg" alt="KORVI" />
            <span>Smart Mobility Platform</span>
          </div>

          <mat-card-header>
            <mat-card-title>Restablecer contrasena</mat-card-title>
            <mat-card-subtitle>Usa el codigo enviado a tu correo.</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <form class="rs-form-grid" [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Correo</mat-label>
                <input matInput formControlName="email" />
                <mat-error *ngIf="form.controls.email.invalid">Ingresa un correo valido.</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Codigo</mat-label>
                <input matInput formControlName="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
                <mat-error *ngIf="form.controls.code.invalid">El codigo debe tener 6 digitos.</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nueva contrasena</mat-label>
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

              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">Actualizar contrasena</button>
            </form>

            <p class="rs-muted"><a routerLink="/recuperar-contrasena">Solicitar otro codigo</a></p>
          </mat-card-content>
        </mat-card>

        <aside class="auth-visual" aria-label="KORVI Smart Mobility Platform">
          <img src="assets/auth/korvi-mobility-city.svg" alt="" aria-hidden="true" />
          <div class="metric-card risk">
            <span>Acceso</span>
            <strong>Seguro</strong>
          </div>
          <div class="metric-card mobility">
            <span>Validacion</span>
            <strong>6 digitos</strong>
          </div>
        </aside>
      </div>
    </section>
  `,
  styleUrls: ['./auth-flow.component.css', './reset-password.component.css'],
})
export class ResetPasswordComponent {
  loading = signal(false);
  passwordVisible = signal(false);
  confirmPasswordVisible = signal(false);
  form = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
  }, { validators: passwordMatchValidator });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastr: ToastrService,
  ) {}

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email, code, password } = this.form.getRawValue();
    this.auth.resetPassword(email, code, password).subscribe({
      next: () => {
        this.toastr.success('Contrasena actualizada. Inicia sesion nuevamente.', 'Listo');
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.toastr.error('Verifica el codigo o solicita uno nuevo.', 'No se pudo actualizar');
        this.loading.set(false);
      },
    });
  }
}
