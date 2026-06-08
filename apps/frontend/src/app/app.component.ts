import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActivityTrackerService } from './core/activity-tracker.service';
import { GlobalLoadingService } from './core/global-loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
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
  `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  constructor(activityTracker: ActivityTrackerService, public readonly loading: GlobalLoadingService) {
    activityTracker.init();
  }
}
