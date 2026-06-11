import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <section class="auth-page">
      <div class="auth-shell">
        <mat-card class="auth-card">
          <div class="brand-lockup">
            <img src="assets/brand/korvi-wordmark.svg" alt="KORVI" />
            <span>Smart Mobility Platform</span>
          </div>

          <mat-card-header>
            <mat-card-title>Recuperar contrasena</mat-card-title>
            <mat-card-subtitle>Te enviaremos un codigo para restablecer el acceso.</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <form class="rs-form-grid" [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field appearance="outline">
                <mat-label>Correo</mat-label>
                <input matInput formControlName="email" />
                <mat-error *ngIf="form.controls.email.invalid">Ingresa un correo valido.</mat-error>
              </mat-form-field>

              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">Enviar codigo</button>
            </form>

            <p class="rs-muted"><a routerLink="/login">Volver al login</a></p>
          </mat-card-content>
        </mat-card>

        <aside class="auth-visual" aria-label="KORVI Smart Mobility Platform">
          <img src="assets/auth/korvi-mobility-city.svg" alt="" aria-hidden="true" />
          <div class="metric-card risk">
            <span>Seguridad</span>
            <strong>Cuenta</strong>
          </div>
          <div class="metric-card mobility">
            <span>Codigo</span>
            <strong>Email</strong>
          </div>
        </aside>
      </div>
    </section>
  `,
  styleUrls: ['./auth-flow.component.css', './forgot-password.component.css'],
})
export class ForgotPasswordComponent {
  loading = signal(false);
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastr: ToastrService,
  ) {}

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email } = this.form.getRawValue();
    this.auth.requestPasswordReset(email).subscribe({
      next: () => {
        this.toastr.info('Si el correo existe, recibiras un codigo.', 'Revisa tu correo');
        this.router.navigate(['/reset-password'], { queryParams: { email } });
      },
      error: () => {
        this.toastr.error('No se pudo solicitar la recuperacion.', 'Error');
        this.loading.set(false);
      },
    });
  }
}
