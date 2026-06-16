import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LandingCard {
  icon: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="landing">
      <section class="hero" id="inicio">
        <img class="hero__background" src="assets/auth/korvi-auth-background.png" alt="" aria-hidden="true" fetchpriority="high" />

        <nav class="nav" aria-label="Primary">
          <a class="brand" href="#inicio" aria-label="Korvi home">
            <img src="assets/brand/korvi-wordmark-light.svg" alt="Korvi" />
          </a>

          <div class="nav__links">
            <a href="#producto">Users</a>
            <a href="#producto">Features</a>
            <a href="#contacto">About us</a>
            <a href="#contacto">Contact</a>
          </div>

          <div class="nav__login">
            <button type="button" class="login-trigger" aria-haspopup="true">
              Login
              <span class="material-icons-outlined" aria-hidden="true">keyboard_arrow_down</span>
            </button>
            <div class="login-popover" role="menu">
              <strong>Access Korvi</strong>
              <span>Enter to view reports, routes with context, and community follow-up.</span>
              <a routerLink="/login" role="menuitem">
                <span class="material-icons-outlined" aria-hidden="true">login</span>
                Sign in
              </a>
            </div>
          </div>

          <a class="nav__cta" href="mailto:contacto@korvi.local">Request demo</a>
        </nav>

        <div class="hero__content">
          <div class="hero__copy">
            <p class="eyebrow">Safe mobility for real people</p>
            <h1>Report road risks and move with more confidence.</h1>
            <p class="hero__lead">
              Korvi helps you report what is happening on the road, check caution points
              before leaving, and follow reports that protect your community.
            </p>
            <div class="hero__actions">
              <a class="button button--primary" href="#producto">
                <span class="material-icons-outlined" aria-hidden="true">explore</span>
                See how it helps
              </a>
              <a class="button button--secondary" routerLink="/login">
                <span class="material-icons-outlined" aria-hidden="true">login</span>
                Enter the system
              </a>
            </div>
          </div>

          <aside class="product-shot" aria-label="Korvi operational preview">
            <div class="product-shot__header">
              <span>Road safety map</span>
              <strong>Live</strong>
            </div>
            <div class="map-preview">
              <span class="map-preview__route"></span>
              <span class="risk-pin risk-pin--high">High</span>
              <span class="risk-pin risk-pin--medium">Medium</span>
              <span class="risk-pin risk-pin--low">Low</span>
            </div>
            <div class="signal-grid">
              <div>
                <span>Weather</span>
                <strong>Moderate rain</strong>
              </div>
              <div>
                <span>Traffic lights</span>
                <strong>12 active</strong>
              </div>
              <div>
                <span>Reports</span>
                <strong>38 today</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="section split-section" id="producto">
        <div class="visual-panel response-visual" aria-hidden="true">
          <img class="visual-panel__image" src="assets/landing/driver-navigation.jpg" alt="" loading="lazy" />
          <span class="material-icons-outlined">support_agent</span>
          <strong>From report to action</strong>
          <p>Korvi shows the right alert to the right person so the problem is not missed.</p>
        </div>

        <div class="section__heading">
          <p class="eyebrow">Main features</p>
          <h2>Everything centers on informing, preventing, and resolving.</h2>
          <p>
            The platform supports real situations: a damaged traffic light, a flooded street,
            an accident, an obstacle, or a route worth avoiding.
          </p>
          <div class="policy-grid">
            @for (policy of mainFeatures; track policy.title) {
              <article class="policy-item">
                <span class="material-icons-outlined" aria-hidden="true">{{ policy.icon }}</span>
                <div>
                  <h3>{{ policy.title }}</h3>
                  <p>{{ policy.text }}</p>
                </div>
              </article>
            }
          </div>
        </div>
      </section>

      <section class="section contact" id="contacto">
        <div>
          <p class="eyebrow">Contact</p>
          <h2>Present Korvi to your community or institution with a clear, easy-to-understand story.</h2>
        </div>
        <div class="contact__actions">
          <a class="button button--primary" href="mailto:contacto@korvi.local">
            <span class="material-icons-outlined" aria-hidden="true">mail</span>
            Contact team
          </a>
          <a class="button button--light" routerLink="/login">
            <span class="material-icons-outlined" aria-hidden="true">login</span>
            Access
          </a>
        </div>
      </section>

      <section class="city-skyline" aria-hidden="true">
        <span></span>
      </section>

      <footer class="landing-footer">
        <a class="footer-brand" href="#inicio" aria-label="Korvi home">
          <img src="assets/brand/korvi-wordmark-light.svg" alt="Korvi" />
        </a>
        <p>Movilidad segura, reportes ciudadanos y seguimiento vial para comunidades mas informadas.</p>
        <nav aria-label="Landing links">
          <a href="#producto">Users</a>
          <a href="#producto">Features</a>
          <a href="#contacto">About us</a>
          <a href="#contacto">Contact</a>
          <a routerLink="/privacy-policy">Privacy</a>
        </nav>
        <span>© 2026 Korvi. Todos los derechos reservados.</span>
      </footer>
    </main>
  `,
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent implements OnInit, OnDestroy {
  readonly mainFeatures: LandingCard[] = [
    {
      icon: 'add_location_alt',
      title: 'Risk map',
      text: 'View nearby reports and understand which areas need more caution before moving.',
    },
    {
      icon: 'photo_camera',
      title: 'Simple evidence',
      text: 'Upload incident photos so other users and institutions can better understand the situation.',
    },
    {
      icon: 'campaign',
      title: 'Useful alerts',
      text: 'Receive clear information about recent risks, weather, or closures that can change your route.',
    },
    {
      icon: 'task_alt',
      title: 'Visible follow-up',
      text: 'Check whether a report was received, is under review, or has already been handled by the responsible team.',
    },
  ];

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngOnInit(): void {
    this.document.body.classList.add('rs-landing-page');
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('rs-landing-page');
  }
}
