import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="password-page">
      <header class="rs-page-header">
        <div>
          <!-- <span class="rs-eyebrow">Seguridad</span> -->
          <h1>Cambiar contrasena</h1>
          <p>{{ auth.user()?.mustChangePassword ? 'Debes cambiar la clave temporal antes de continuar.' : 'Actualiza tu contrasena usando tu clave actual.' }}</p>
        </div>
      </header>

      <mat-card class="password-card">
        <form class="rs-form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Contrasena actual</mat-label>
            <input matInput [type]="currentVisible() ? 'text' : 'password'" formControlName="currentPassword" />
            <button mat-icon-button matSuffix type="button" [attr.aria-label]="currentVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="currentVisible.update(value => !value)">
              <mat-icon>{{ currentVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error *ngIf="form.controls.currentPassword.invalid">La contrasena actual es requerida.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nueva contrasena</mat-label>
            <input matInput [type]="newVisible() ? 'text' : 'password'" formControlName="newPassword" />
            <button mat-icon-button matSuffix type="button" [attr.aria-label]="newVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="newVisible.update(value => !value)">
              <mat-icon>{{ newVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error *ngIf="form.controls.newPassword.invalid">Debe tener al menos 8 caracteres.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirmar nueva contrasena</mat-label>
            <input matInput [type]="confirmVisible() ? 'text' : 'password'" formControlName="confirmPassword" />
            <button mat-icon-button matSuffix type="button" [attr.aria-label]="confirmVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'" (click)="confirmVisible.update(value => !value)">
              <mat-icon>{{ confirmVisible() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error *ngIf="form.controls.confirmPassword.invalid || form.hasError('passwordMismatch')">Las contrasenas deben coincidir.</mat-error>
          </mat-form-field>

          <div class="actions">
            <a mat-button routerLink="/perfil" *ngIf="!auth.user()?.mustChangePassword">Volver al perfil</a>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">Guardar cambio</button>
          </div>
        </form>
      </mat-card>
    </section>
  `,
  styleUrls: ['./change-password.component.css'],
})
export class ChangePasswordComponent {
  loading = signal(false);
  currentVisible = signal(false);
  newVisible = signal(false);
  confirmVisible = signal(false);
  form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
  }, { validators: passwordMatchValidator });

  constructor(
    private readonly fb: FormBuilder,
    readonly auth: AuthService,
    private readonly toastr: ToastrService,
    private readonly router: Router,
  ) {}

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.toastr.success('Contrasena actualizada correctamente.', 'Seguridad');
        this.form.reset();
        this.auth.refreshUser().subscribe(() => {
          this.loading.set(false);
          this.router.navigateByUrl(this.auth.canViewExecutivePanel() ? '/dashboard' : '/reportes');
        });
      },
      error: () => {
        this.toastr.error('Verifica tu contrasena actual.', 'No se pudo actualizar');
        this.loading.set(false);
      },
    });
  }
}
