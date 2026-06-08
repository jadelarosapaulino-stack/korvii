import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-activate-account',
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
            <mat-card-title>Activar cuenta</mat-card-title>
            <mat-card-subtitle>Ingresa el codigo enviado a tu correo.</mat-card-subtitle>
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

              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">Activar y entrar</button>
            </form>

            <div class="auth-actions">
              <button mat-button type="button" [disabled]="form.controls.email.invalid || loading()" (click)="resend()">Reenviar codigo</button>
              <a routerLink="/login">Volver al login</a>
            </div>
          </mat-card-content>
        </mat-card>

        <aside class="auth-visual" aria-label="KORVI Smart Mobility Platform">
          <img src="assets/auth/korvi-mobility-city.svg" alt="" aria-hidden="true" />
          <div class="metric-card risk">
            <span>Cuenta</span>
            <strong>Activa</strong>
          </div>
          <div class="metric-card mobility">
            <span>Codigo</span>
            <strong>Email</strong>
          </div>
        </aside>
      </div>
    </section>
  `,
  styleUrls: ['./auth-flow.component.css', './activate-account.component.css'],
})
export class ActivateAccountComponent {
  loading = signal(false);
  form = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

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
    const { email, code } = this.form.getRawValue();
    this.auth.activateAccount(email, code).subscribe({
      next: () => {
        this.toastr.success('Cuenta activada correctamente.', 'Bienvenido');
        this.router.navigateByUrl(this.auth.canViewExecutivePanel() ? '/dashboard' : '/reportes');
      },
      error: () => {
        this.toastr.error('Verifica el codigo o solicita uno nuevo.', 'No se pudo activar');
        this.loading.set(false);
      },
    });
  }

  resend() {
    const email = this.form.controls.email.value;
    this.loading.set(true);
    this.auth.resendActivationCode(email).subscribe({
      next: () => {
        this.toastr.info('Si el correo existe, recibiras un codigo nuevo.', 'Codigo enviado');
        this.loading.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo reenviar el codigo.', 'Error');
        this.loading.set(false);
      },
    });
  }
}
