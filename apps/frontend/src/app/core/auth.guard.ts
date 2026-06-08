import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { FeatureFlagsService } from './feature-flags.service';
import { RolePermissionsService } from './role-permissions.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    if (auth.user()?.mustChangePassword && state.url !== '/perfil/cambiar-contrasena') {
      return router.createUrlTree(['/perfil/cambiar-contrasena']);
    }
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;
  if (auth.user()?.mustChangePassword) return router.createUrlTree(['/perfil/cambiar-contrasena']);
  return router.createUrlTree([auth.canViewExecutivePanel() ? '/dashboard' : '/reportes']);
};

export const reportManagerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const permissions = inject(RolePermissionsService);

  if (auth.canManageReports()) return true;
  return permissions.load().pipe(
    map(() => {
      const baseRole = permissions.baseRoleFor(auth.user()?.role);
      return ['MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN'].includes(baseRole) ? true : router.createUrlTree(['/reportes']);
    }),
  );
};

export const executivePanelGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const permissions = inject(RolePermissionsService);

  if (auth.canViewExecutivePanel()) return true;
  return permissions.load().pipe(
    map(() => {
      const baseRole = permissions.baseRoleFor(auth.user()?.role);
      return ['MODERATOR', 'INSTITUTION_ADMIN', 'INSURANCE_ADMIN', 'SUPER_ADMIN'].includes(baseRole) ? true : router.createUrlTree(['/reportes']);
    }),
  );
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const permissions = inject(RolePermissionsService);

  if (auth.canManageSystem()) return true;
  return permissions.load().pipe(
    map(() => permissions.baseRoleFor(auth.user()?.role) === 'SUPER_ADMIN' ? true : router.createUrlTree(['/reportes'])),
  );
};

export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const permissions = inject(RolePermissionsService);
  const permissionKey = route.data?.['permissionKey'] as string | undefined;
  const permissionAnyOf = route.data?.['permissionAnyOf'] as string[] | undefined;

  if (!permissionKey && !permissionAnyOf?.length) return true;

  return permissions.load().pipe(
    map(() => {
      const role = auth.user()?.role;
      const allowed = permissionKey
        ? permissions.isEnabled(role, permissionKey)
        : Boolean(permissionAnyOf?.some((key) => permissions.isEnabled(role, key)));

      return allowed ? true : router.createUrlTree([fallbackRoute(auth, permissions)]);
    }),
  );
};

export const featureFlagGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const featureFlags = inject(FeatureFlagsService);
  const featureKey = route.data?.['featureKey'] as string | undefined;
  const featureAnyOf = route.data?.['featureAnyOf'] as string[] | undefined;

  if (!featureKey && !featureAnyOf?.length) return true;

  return featureFlags.load().pipe(
    map(() => {
      const allowed = featureKey
        ? featureFlags.isEnabled(featureKey)
        : Boolean(featureAnyOf?.some((key) => featureFlags.isEnabled(key)));
      return allowed ? true : router.createUrlTree(['/reportes']);
    }),
  );
};

function fallbackRoute(auth: AuthService, permissions: RolePermissionsService): string {
  const role = auth.user()?.role;
  const candidates = [
    { key: 'reports', route: '/reportes' },
    { key: 'map', route: '/mapa' },
    { key: 'education', route: '/educacion' },
    { key: 'dashboard', route: '/dashboard' },
  ];
  return candidates.find((candidate) => permissions.isEnabled(role, candidate.key))?.route ?? '/perfil';
}
