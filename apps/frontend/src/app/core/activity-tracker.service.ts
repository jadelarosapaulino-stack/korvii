import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, fromEvent } from 'rxjs';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ActivityTrackerService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private initialized = false;
  private lastClickKey = '';
  private lastClickAt = 0;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.track('navigation', 'screen_view', {
        screen: event.urlAfterRedirects,
        metadata: { url: event.urlAfterRedirects },
      });
    });

    fromEvent<MouseEvent>(this.document, 'click').subscribe((event) => {
      const target = event.target instanceof Element ? event.target.closest('button,a,[role="button"],mat-chip') : null;
      if (!target) return;

      const action = this.elementAction(target);
      const now = Date.now();
      const key = `${action}:${this.router.url}`;
      if (key === this.lastClickKey && now - this.lastClickAt < 700) return;
      this.lastClickKey = key;
      this.lastClickAt = now;

      this.track('click', action, {
        screen: this.router.url,
        element: this.elementDescriptor(target),
      });
    });
  }

  track(eventType: string, action: string, data: { screen?: string; element?: string; metadata?: Record<string, unknown> } = {}) {
    if (!localStorage.getItem('ruta_segura_token')) return;
    this.http.post(`${API_URL}/activity/events`, {
      eventType,
      action,
      platform: 'web',
      ...data,
    }).subscribe({ error: () => undefined });
  }

  private elementAction(element: Element): string {
    const label = (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || element.tagName).trim();
    return label.toLowerCase().replace(/\s+/g, '_').slice(0, 120) || 'ui_interaction';
  }

  private elementDescriptor(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const label = (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim().slice(0, 80);
    return label ? `${tag}:${label}` : tag;
  }
}
