import { Component, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActivityTrackerService } from './core/activity-tracker.service';
import { AutoTranslateDirective } from './core/auto-translate.directive';
import { AuthService } from './core/auth.service';
import { GlobalLoadingService } from './core/global-loading.service';
import { I18nService } from './core/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AutoTranslateDirective],
  template: `
    <div appAutoTranslate>
      @if (!auth.isAuthenticated()) {
        <div class="public-language-selector" role="group" aria-label="Selector de idioma">
          <button type="button" [class.active]="i18n.language() === 'es'" title="Espanol" aria-label="Espanol" (click)="i18n.setLanguage('es')">
            <img class="flag-icon" src="assets/flags/do.svg" alt="" aria-hidden="true" />
            <span class="language-copy"><strong>ES</strong></span>
          </button>
          <button type="button" [class.active]="i18n.language() === 'en'" title="English" aria-label="English" (click)="i18n.setLanguage('en')">
            <img class="flag-icon" src="assets/flags/us.svg" alt="" aria-hidden="true" />
            <span class="language-copy"><strong>EN</strong></span>
          </button>
        </div>
      }
      <router-outlet />
      @if (loading.loading()) {
        <div class="global-loading" role="status" aria-live="polite" aria-label="Cargando KORVI">
          <div class="loading-panel">
            <div class="loading-wordmark" aria-hidden="true">
              <span>K</span><span>O</span><span>R</span><span>V</span><span>I</span>
            </div>
            <span class="loading-label">Mobility intelligence</span>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  constructor(
    activityTracker: ActivityTrackerService,
    public readonly auth: AuthService,
    public readonly i18n: I18nService,
    public readonly loading: GlobalLoadingService,
  ) {
    activityTracker.init();
    effect(() => {
      if (!this.auth.user()) {
        document.body.classList.remove('rs-dark-theme');
      }
    });
  }
}
