import { effect, Injectable, signal } from '@angular/core';

export type AppLanguage = 'es' | 'en';

const STORAGE_KEY = 'korvi_language';

const EN_DICTIONARY: Record<string, string> = {
  'Korvi inicio': 'Korvi home',
  'Principal': 'Main',
  'Selector de idioma': 'Language selector',
  'Español': 'Spanish',
  'Usuarios': 'Users',
  'Funciones': 'Features',
  'Sobre nosotros': 'About us',
  'Contacto': 'Contact',
  'Solicitar demo': 'Request demo',
  'Accede al sistema Korvi': 'Access the Korvi system',
  'Entra para ver reportes, rutas con contexto y seguimiento de tu comunidad.': 'Sign in to view reports, context-aware routes, and community follow-up.',
  'Iniciar sesión': 'Sign in',
  'Movilidad segura para personas reales': 'Safe mobility for real people',
  'Reporta riesgos viales y muévete con más confianza.': 'Report road risks and move with more confidence.',
  'Korvi te ayuda a avisar lo que pasa en la vía, ver puntos de cuidado antes de salir y dar seguimiento a los reportes que protegen a tu comunidad.': 'Korvi helps you report what is happening on the road, check caution points before leaving, and follow reports that protect your community.',
  'Conocer cómo ayuda': 'See how it helps',
  'Entrar al sistema': 'Enter the system',
  'Vista previa operativa de Korvi': 'Korvi operational preview',
  'Mapa de seguridad vial': 'Road safety map',
  'En vivo': 'Live',
  'Alto': 'High',
  'Medio': 'Medium',
  'Bajo': 'Low',
  'Clima': 'Weather',
  'Lluvia moderada': 'Moderate rain',
  'Semáforos': 'Traffic lights',
  '12 activos': '12 active',
  'Reportes': 'Reports',
  '38 hoy': '38 today',
  'Para usuarios': 'For users',
  'Funciones simples para viajar mejor y cuidar tu entorno.': 'Simple features to travel better and care for your surroundings.',
  'El landing explica lo esencial: cómo reportar un peligro, consultar una zona, recibir avisos útiles y conectar el caso con quien puede atenderlo.': 'The landing page explains the essentials: how to report a hazard, check an area, receive useful alerts, and connect the case with whoever can handle it.',
  'Reporta lo que ves': 'Report what you see',
  'Marca el punto del problema, agrega una foto y describe lo que viste en pocos pasos.': 'Mark the problem location, add a photo, and describe what you saw in a few steps.',
  'Muévete con contexto': 'Move with context',
  'Revisa calles con incidentes, lluvia, inundaciones o semáforos fuera de servicio antes de salir.': 'Check streets with incidents, rain, flooding, or offline traffic lights before leaving.',
  'Recibe respuesta coordinada': 'Get coordinated response',
  'Cada aviso puede pasar de la comunidad al equipo que debe revisar, priorizar o resolver.': 'Each alert can move from the community to the team that must review, prioritize, or resolve it.',
  'Funciones destacadas': 'Featured features',
  'Persona conduciendo en ciudad con atención a la ruta': 'Person driving in the city while paying attention to the route',
  'Consulta alertas antes de moverte.': 'Check alerts before moving.',
  'Carretera abierta para planificar viajes con más contexto': 'Open road for planning trips with more context',
  'Elige trayectos con mejor información.': 'Choose routes with better information.',
  'Del reporte a la acción': 'From report to action',
  'Korvi muestra el aviso correcto a la persona correcta para que el problema no se pierda.': 'Korvi shows the right alert to the right person so the problem is not missed.',
  'Funciones principales': 'Main features',
  'Todo gira alrededor de informar, prevenir y resolver.': 'Everything centers on informing, preventing, and resolving.',
  'La plataforma acompaña situaciones reales: un semáforo dañado, una calle inundada, un accidente, un obstáculo o una ruta que conviene evitar.': 'The platform supports real situations: a damaged traffic light, a flooded street, an accident, an obstacle, or a route worth avoiding.',
  'Mapa de riesgos': 'Risk map',
  'Visualiza reportes cercanos y entiende qué zonas requieren más cuidado antes de moverte.': 'View nearby reports and understand which areas need more caution before moving.',
  'Evidencia sencilla': 'Simple evidence',
  'Sube fotos del incidente para que otros usuarios e instituciones comprendan mejor la situación.': 'Upload incident photos so other users and institutions can better understand the situation.',
  'Alertas útiles': 'Useful alerts',
  'Recibe información clara sobre riesgos recientes, clima o bloqueos que pueden cambiar tu trayecto.': 'Receive clear information about recent risks, weather, or closures that can change your route.',
  'Seguimiento visible': 'Visible follow-up',
  'Consulta si un reporte fue recibido, está en revisión o ya fue atendido por el equipo responsable.': 'Check whether a report was received, is under review, or has already been handled by the responsible team.',
  'Impacto': 'Impact',
  'Diseñado para que cada aviso tenga seguimiento y valor público.': 'Designed so every alert has follow-up and public value.',
  'avisos disponibles cuando aparece un riesgo': 'alerts available when a risk appears',
  'para crear un reporte con ubicación y foto': 'to create a report with location and photo',
  'mirada compartida entre comunidad e instituciones': 'shared view between community and institutions',
  'Construimos una forma más cercana de cuidar las vías que usamos todos los días.': 'We build a closer way to care for the roads we use every day.',
  'Para la ciudadanía': 'For citizens',
  'Una forma simple de avisar peligros de la calle sin depender de llamadas o mensajes dispersos.': 'A simple way to report street hazards without relying on calls or scattered messages.',
  'Para operadores': 'For operators',
  'Una vista clara de lo que está ocurriendo para organizar mejor la respuesta diaria.': 'A clear view of what is happening to better organize the daily response.',
  'Para la ciudad': 'For the city',
  'Los reportes ayudan a identificar patrones y prevenir que los mismos riesgos se repitan.': 'Reports help identify patterns and prevent the same risks from happening again.',
  'Presenta Korvi a tu comunidad o institución con una historia clara y fácil de entender.': 'Present Korvi to your community or institution with a clear, easy-to-understand story.',
  'Contactar equipo': 'Contact team',
  'Acceder': 'Access',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<AppLanguage>(this.readInitialLanguage());

  constructor() {
    effect(() => {
      const language = this.language();
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    });
  }

  setLanguage(language: AppLanguage) {
    this.language.set(language);
  }

  translate(value: string | null | undefined): string {
    if (!value || this.language() === 'es') return value ?? '';
    const trimmed = value.trim();
    const leading = value.match(/^\s*/)?.[0] ?? '';
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    const exact = EN_DICTIONARY[trimmed];
    return exact ? `${leading}${exact}${trailing}` : value;
  }

  private readInitialLanguage(): AppLanguage {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;

    const deviceLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const preferredLanguage = deviceLanguages.find((language) => /^en|^es/i.test(language));
    return preferredLanguage?.toLowerCase().startsWith('en') ? 'en' : 'es';
  }
}
