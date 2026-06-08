import { Routes } from '@angular/router';
import { ShellComponent } from './features/layout/shell.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { ActivateAccountComponent } from './features/auth/activate-account.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { IntelligenceComponent } from './features/intelligence/intelligence.component';
import { ReportCreateComponent } from './features/reports/report-create.component';
import { ReportListComponent } from './features/reports/report-list.component';
import { ReportMapComponent } from './features/reports/report-map.component';
import { EducationComponent } from './features/education/education.component';
import { EducationLessonComponent } from './features/education/education-lesson.component';
import { AdminAccessComponent } from './features/admin/admin-access.component';
import { AdminReportsComponent } from './features/admin/admin-reports.component';
import { AdminTrafficLightsComponent } from './features/admin/admin-traffic-lights.component';
import { AdminPanelComponent } from './features/admin/admin-panel.component';
import { AdminEducationComponent } from './features/admin/admin-education.component';
import { SystemAdminComponent } from './features/admin/system-admin.component';
import { UserProfileComponent } from './features/profile/user-profile.component';
import { ChangePasswordComponent } from './features/profile/change-password.component';
import { authGuard, executivePanelGuard, featureFlagGuard, guestGuard, permissionGuard, reportManagerGuard, superAdminGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'registro', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'activar-cuenta', component: ActivateAccountComponent, canActivate: [guestGuard] },
  { path: 'recuperar-contrasena', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'restablecer-contrasena', component: ResetPasswordComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'reportes' },
      { path: 'dashboard', component: DashboardComponent, canActivate: [executivePanelGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'dashboard', permissionKey: 'dashboard' } },
      { path: 'intelligence', component: IntelligenceComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'intelligence', permissionKey: 'intelligence' } },
      { path: 'reportes', component: ReportListComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'reports', permissionKey: 'reports' } },
      { path: 'reportes/nuevo', component: ReportCreateComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'new-report', permissionKey: 'new-report' } },
      { path: 'mapa', component: ReportMapComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'map', permissionKey: 'map' } },
      { path: 'educacion', component: EducationComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'education', permissionKey: 'education' } },
      { path: 'educacion/:id', component: EducationLessonComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'education', permissionKey: 'education' } },
      { path: 'perfil', component: UserProfileComponent },
      { path: 'perfil/cambiar-contrasena', component: ChangePasswordComponent },
      { path: 'admin', component: AdminPanelComponent, canActivate: [reportManagerGuard, permissionGuard], data: { permissionAnyOf: ['admin-reports', 'admin-education', 'admin-traffic-lights', 'admin-users', 'admin-roles', 'admin-system'] } },
      { path: 'admin/sistema', component: SystemAdminComponent, canActivate: [superAdminGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-system', permissionKey: 'admin-system' } },
      { path: 'admin/usuarios', component: AdminAccessComponent, canActivate: [superAdminGuard, featureFlagGuard, permissionGuard], data: { featureAnyOf: ['admin-users', 'admin-roles'], permissionAnyOf: ['admin-users', 'admin-roles'] } },
      { path: 'admin/roles', redirectTo: 'admin/usuarios' },
      { path: 'admin/reportes', component: AdminReportsComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-reports', permissionKey: 'admin-reports' } },
      { path: 'admin/semaforos', component: AdminTrafficLightsComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-traffic-lights', permissionKey: 'admin-traffic-lights' } },
      { path: 'admin/educacion', component: AdminEducationComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-education', permissionKey: 'admin-education' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
