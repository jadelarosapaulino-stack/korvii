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
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'activate-account', component: ActivateAccountComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'map' },
      { path: 'dashboard', component: DashboardComponent, canActivate: [executivePanelGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'dashboard', permissionKey: 'dashboard' } },
      { path: 'intelligence', component: IntelligenceComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'intelligence', permissionKey: 'intelligence' } },
      { path: 'reports', component: ReportListComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'reports', permissionKey: 'reports' } },
      { path: 'reports/new', component: ReportCreateComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'new-report', permissionKey: 'reports' } },
      { path: 'map', component: ReportMapComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'map', permissionKey: 'map' } },
      { path: 'education', component: EducationComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'education', permissionKey: 'education' } },
      { path: 'education/:id', component: EducationLessonComponent, canActivate: [featureFlagGuard, permissionGuard], data: { featureKey: 'education', permissionKey: 'education' } },
      { path: 'profile', component: UserProfileComponent },
      { path: 'profile/change-password', component: ChangePasswordComponent },
      { path: 'admin', component: AdminPanelComponent, canActivate: [reportManagerGuard, permissionGuard], data: { permissionAnyOf: ['admin-reports', 'admin-education', 'admin-traffic-lights', 'admin-users', 'admin-roles', 'admin-system'] } },
      { path: 'admin/system', component: SystemAdminComponent, canActivate: [superAdminGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-system', permissionKey: 'admin-system' } },
      { path: 'admin/users', component: AdminAccessComponent, canActivate: [superAdminGuard, featureFlagGuard, permissionGuard], data: { featureAnyOf: ['admin-users', 'admin-roles'], permissionAnyOf: ['admin-users', 'admin-roles'] } },
      { path: 'admin/roles', redirectTo: 'admin/users' },
      { path: 'admin/reports', component: AdminReportsComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-reports', permissionKey: 'admin-reports' } },
      { path: 'admin/traffic-lights', component: AdminTrafficLightsComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-traffic-lights', permissionKey: 'admin-traffic-lights' } },
      { path: 'admin/education', component: AdminEducationComponent, canActivate: [reportManagerGuard, featureFlagGuard, permissionGuard], data: { featureKey: 'admin-education', permissionKey: 'admin-education' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
