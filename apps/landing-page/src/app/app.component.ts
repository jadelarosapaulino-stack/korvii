import { Component, inject } from '@angular/core';
import { AutoTranslateDirective } from './auto-translate.directive';
import { AppLanguage, I18nService } from './i18n.service';
import { LANDING_SYSTEM_URL } from './landing-env';

interface IconCard {
  icon: string;
  title: string;
  text: string;
}

interface Metric {
  value: string;
  label: string;
}

@Component({
  selector: 'landing-root',
  standalone: true,
  imports: [AutoTranslateDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly i18n = inject(I18nService);
  readonly language = this.i18n.language;
  readonly systemLoginUrl = this.resolveSystemLoginUrl();

  readonly metrics: Metric[] = [
    { value: '24/7', label: 'avisos disponibles cuando aparece un riesgo' },
    { value: '3 min', label: 'para crear un reporte con ubicación y foto' },
    { value: '360', label: 'mirada compartida entre comunidad e instituciones' },
  ];

  readonly userBenefits: IconCard[] = [
    {
      icon: 'report',
      title: 'Reporta lo que ves',
      text: 'Marca el punto del problema, agrega una foto y describe lo que viste en pocos pasos.',
    },
    {
      icon: 'route',
      title: 'Muévete con contexto',
      text: 'Revisa calles con incidentes, lluvia, inundaciones o semáforos fuera de servicio antes de salir.',
    },
    {
      icon: 'notifications_active',
      title: 'Recibe respuesta coordinada',
      text: 'Cada aviso puede pasar de la comunidad al equipo que debe revisar, priorizar o resolver.',
    },
  ];

  readonly mainFeatures: IconCard[] = [
    {
      icon: 'add_location_alt',
      title: 'Mapa de riesgos',
      text: 'Visualiza reportes cercanos y entiende qué zonas requieren más cuidado antes de moverte.',
    },
    {
      icon: 'photo_camera',
      title: 'Evidencia sencilla',
      text: 'Sube fotos del incidente para que otros usuarios e instituciones comprendan mejor la situación.',
    },
    {
      icon: 'campaign',
      title: 'Alertas útiles',
      text: 'Recibe información clara sobre riesgos recientes, clima o bloqueos que pueden cambiar tu trayecto.',
    },
    {
      icon: 'task_alt',
      title: 'Seguimiento visible',
      text: 'Consulta si un reporte fue recibido, está en revisión o ya fue atendido por el equipo responsable.',
    },
  ];

  readonly aboutCards: IconCard[] = [
    {
      icon: 'groups',
      title: 'Para la ciudadanía',
      text: 'Una forma simple de avisar peligros de la calle sin depender de llamadas o mensajes dispersos.',
    },
    {
      icon: 'traffic',
      title: 'Para operadores',
      text: 'Una vista clara de lo que está ocurriendo para organizar mejor la respuesta diaria.',
    },
    {
      icon: 'insights',
      title: 'Para la ciudad',
      text: 'Los reportes ayudan a identificar patrones y prevenir que los mismos riesgos se repitan.',
    },
  ];

  setLanguage(language: AppLanguage) {
    this.i18n.setLanguage(language);
  }

  private resolveSystemLoginUrl(): string {
    const configuredUrl = this.trimTrailingSlash(
      this.runtimeSystemUrl() || LANDING_SYSTEM_URL,
    );
    const externalUrl = this.externalSystemUrl(configuredUrl);
    return externalUrl ? `${externalUrl}/krv/login` : '/krv/login';
  }

  private trimTrailingSlash(value: string): string {
    return value.trim().replace(/\/+$/, '');
  }

  private externalSystemUrl(value: string): string {
    if (!value) return '';

    const normalizedValue = value.replace(/\/krv$/, '');
    if (typeof window === 'undefined') return normalizedValue;

    try {
      const configured = new URL(normalizedValue);
      if (configured.hostname === window.location.hostname) return '';
      return configured.origin;
    } catch {
      return normalizedValue;
    }
  }

  private runtimeSystemUrl(): string {
    if (typeof window === 'undefined') return '';
    const config = (window as Window & { __KORVI_LANDING_CONFIG__?: { systemUrl?: string } }).__KORVI_LANDING_CONFIG__;
    return config?.systemUrl ?? '';
  }
}
