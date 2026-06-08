import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { provideToastr } from 'ngx-toastr';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AuthService } from './app/core/auth.service';
import { authInterceptor } from './app/core/auth.interceptor';
import { loadingInterceptor } from './app/core/loading.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideToastr({
      closeButton: true,
      progressBar: true,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      timeOut: 3500,
    }),
    provideHttpClient(withInterceptors([loadingInterceptor, authInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return auth.isAuthenticated() ? firstValueFrom(auth.refreshUser()) : undefined;
    }),
  ],
}).catch((err) => console.error(err));
