import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalLoadingService {
  private readonly pendingRequests = signal(0);
  readonly loading = computed(() => this.pendingRequests() > 0);

  start() {
    this.pendingRequests.update((value) => value + 1);
  }

  finish() {
    window.setTimeout(() => {
      this.pendingRequests.update((value) => Math.max(0, value - 1));
    }, 0);
  }
}
