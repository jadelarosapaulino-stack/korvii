import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LandingCard {
  icon: string;
  title: string;
  text: string;
}

interface LandingMetric {
  value: string;
  label: string;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="landing">
      <section class="hero" id="inicio">
        <img
          class="hero__background"
          src="assets/auth/korvi-auth-background.png"
          alt=""
          aria-hidden="true"
          fetchpriority="high" />

        <nav class="nav" aria-label="Principal">
          <a class="brand" href="#inicio" aria-label="Korvi inicio">
            <img src="assets/brand/korvi-wordmark-dark.svg" alt="Korvi" />
          </a>

          <div class="nav__links">
            <a href="#producto">Usuarios</a>
            <a href="#funciones">Funciones</a>
            <a href="#nosotros">Sobre nosotros</a>
            <a href="#contacto">Contacto</a>
          </div>

          <div class="nav__login">
            <button type="button" class="login-trigger" aria-haspopup="true">
              Login
              <span class="material-icons-outlined" aria-hidden="true">keyboard_arrow_down</span>
            </button>
            <div class="login-popover" role="menu">
              <strong>Accede al sistema Korvi</strong>
              <span>Entra para ver reportes, rutas con contexto y seguimiento de tu comunidad.</span>
              <a routerLink="/login" role="menuitem">
                <span class="material-icons-outlined" aria-hidden="true">login</span>
                Iniciar sesion
              </a>
            </div>
          </div>

          <a class="nav__cta" href="mailto:contacto@korvi.local">Solicitar demo</a>
        </nav>

        <div class="hero__content">
          <div class="hero__copy">
            <p class="eyebrow">Movilidad segura para personas reales</p>
            <h1>Reporta riesgos viales y muevete con mas confianza.</h1>
            <p class="hero__lead">
              Korvi te ayuda a avisar lo que pasa en la via, ver puntos de cuidado antes
              de salir y dar seguimiento a los reportes que protegen a tu comunidad.
            </p>
            <div class="hero__actions">
              <a class="button button--primary" href="#producto">
                <span class="material-icons-outlined" aria-hidden="true">explore</span>
                Conocer como ayuda
              </a>
              <a class="button button--secondary" routerLink="/login">
                <span class="material-icons-outlined" aria-hidden="true">login</span>
                Entrar al sistema
              </a>
            </div>
          </div>

          <aside class="product-shot" aria-label="Vista previa operativa de Korvi">
            <div class="product-shot__header">
              <span>Mapa de seguridad vial</span>
              <strong>En vivo</strong>
            </div>
            <div class="map-preview">
              <span class="map-preview__route"></span>
              <span class="risk-pin risk-pin--high">Alto</span>
              <span class="risk-pin risk-pin--medium">Medio</span>
              <span class="risk-pin risk-pin--low">Bajo</span>
            </div>
            <div class="signal-grid">
              <div>
                <span>Clima</span>
                <strong>Lluvia moderada</strong>
              </div>
              <div>
                <span>Semaforos</span>
                <strong>12 activos</strong>
              </div>
              <div>
                <span>Reportes</span>
                <strong>38 hoy</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="section intro" id="producto">
        <div class="section__heading">
          <p class="eyebrow">Para usuarios</p>
          <h2>Funciones simples para viajar mejor y cuidar tu entorno.</h2>
          <p>
            El landing explica lo esencial: como reportar un peligro, consultar una zona,
            recibir avisos utiles y conectar el caso con quien puede atenderlo.
          </p>
        </div>
        <div class="benefits">
          @for (benefit of userBenefits; track benefit.title) {
            <article class="benefit-card">
              <span class="material-icons-outlined" aria-hidden="true">{{ benefit.icon }}</span>
              <h3>{{ benefit.title }}</h3>
              <p>{{ benefit.text }}</p>
            </article>
          }
        </div>
      </section>

      <section class="section image-story" aria-label="Funciones destacadas">
        <figure>
          <img src="assets/landing/driver-navigation.jpg" alt="Persona conduciendo en ciudad con atencion a la ruta" />
          <figcaption>Consulta alertas antes de moverte.</figcaption>
        </figure>
        <figure>
          <img src="assets/landing/community-road.jpg" alt="Carretera abierta para planificar viajes con mas contexto" />
          <figcaption>Elige trayectos con mejor informacion.</figcaption>
        </figure>
      </section>

      <section class="section split-section" id="funciones">
        <div class="visual-panel response-visual" aria-hidden="true">
          <span class="material-icons-outlined">support_agent</span>
          <strong>Del reporte a la accion</strong>
          <p>Korvi muestra el aviso correcto a la persona correcta para que el problema no se pierda.</p>
        </div>

        <div class="section__heading">
          <p class="eyebrow">Funciones principales</p>
          <h2>Todo gira alrededor de informar, prevenir y resolver.</h2>
          <p>
            La plataforma acompana situaciones reales: un semaforo danado, una calle
            inundada, un accidente, un obstaculo o una ruta que conviene evitar.
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

      <section class="section impact" id="impacto">
        <div class="impact__panel">
          <div>
            <p class="eyebrow">Impacto</p>
            <h2>Disenado para que cada aviso tenga seguimiento y valor publico.</h2>
          </div>
          <div class="metrics">
            @for (metric of metrics; track metric.label) {
              <div class="metric">
                <strong>{{ metric.value }}</strong>
                <span>{{ metric.label }}</span>
              </div>
            }
          </div>
        </div>
      </section>

      <section class="section about" id="nosotros">
        <div class="section__heading">
          <p class="eyebrow">Sobre nosotros</p>
          <h2>Construimos una forma mas cercana de cuidar las vias que usamos todos los dias.</h2>
        </div>
        <div class="about-grid">
          @for (card of aboutCards; track card.title) {
            <article class="about-card">
              <span class="material-icons-outlined" aria-hidden="true">{{ card.icon }}</span>
              <h3>{{ card.title }}</h3>
              <p>{{ card.text }}</p>
            </article>
          }
        </div>
      </section>

      <section class="section contact" id="contacto">
        <div>
          <p class="eyebrow">Contacto</p>
          <h2>Presenta Korvi a tu comunidad o institucion con una historia clara y facil de entender.</h2>
        </div>
        <div class="contact__actions">
          <a class="button button--primary" href="mailto:contacto@korvi.local">
            <span class="material-icons-outlined" aria-hidden="true">mail</span>
            Contactar equipo
          </a>
          <a class="button button--light" routerLink="/login">
            <span class="material-icons-outlined" aria-hidden="true">login</span>
            Acceder
          </a>
        </div>
      </section>
    </main>
  `,
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent implements OnInit, OnDestroy {
  readonly metrics: LandingMetric[] = [
    { value: '24/7', label: 'avisos disponibles cuando aparece un riesgo' },
    { value: '3 min', label: 'para crear un reporte con ubicacion y foto' },
    { value: '360', label: 'mirada compartida entre comunidad e instituciones' },
  ];

  readonly userBenefits: LandingCard[] = [
    {
      icon: 'report',
      title: 'Reporta lo que ves',
      text: 'Marca el punto del problema, agrega una foto y describe lo que viste en pocos pasos.',
    },
    {
      icon: 'route',
      title: 'Muevete con contexto',
      text: 'Revisa calles con incidentes, lluvia, inundaciones o semaforos fuera de servicio antes de salir.',
    },
    {
      icon: 'notifications_active',
      title: 'Recibe respuesta coordinada',
      text: 'Cada aviso puede pasar de la comunidad al equipo que debe revisar, priorizar o resolver.',
    },
  ];

  readonly mainFeatures: LandingCard[] = [
    {
      icon: 'add_location_alt',
      title: 'Mapa de riesgos',
      text: 'Visualiza reportes cercanos y entiende que zonas requieren mas cuidado antes de moverte.',
    },
    {
      icon: 'photo_camera',
      title: 'Evidencia sencilla',
      text: 'Sube fotos del incidente para que otros usuarios e instituciones comprendan mejor la situacion.',
    },
    {
      icon: 'campaign',
      title: 'Alertas utiles',
      text: 'Recibe informacion clara sobre riesgos recientes, clima o bloqueos que pueden cambiar tu trayecto.',
    },
    {
      icon: 'task_alt',
      title: 'Seguimiento visible',
      text: 'Consulta si un reporte fue recibido, esta en revision o ya fue atendido por el equipo responsable.',
    },
  ];

  readonly aboutCards: LandingCard[] = [
    {
      icon: 'groups',
      title: 'Para la ciudadania',
      text: 'Una forma simple de avisar peligros de la calle sin depender de llamadas o mensajes dispersos.',
    },
    {
      icon: 'traffic',
      title: 'Para operadores',
      text: 'Una vista clara de lo que esta ocurriendo para organizar mejor la respuesta diaria.',
    },
    {
      icon: 'insights',
      title: 'Para la ciudad',
      text: 'Los reportes ayudan a identificar patrones y prevenir que los mismos riesgos se repitan.',
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
