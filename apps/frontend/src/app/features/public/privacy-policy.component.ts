import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="privacy-page">
      <nav class="privacy-nav" aria-label="Privacy navigation">
        <a class="brand" routerLink="/" aria-label="Korvi home">
          <img src="assets/brand/korvi-wordmark-dark.svg" alt="Korvi" />
        </a>
        <div>
          <a routerLink="/">Landing</a>
          <a routerLink="/login">Login</a>
        </div>
      </nav>

      <header class="privacy-hero">
        <p class="eyebrow">Politicas y privacidad</p>
        <h1>Tu informacion debe ayudarte a moverte mejor, no exponerte.</h1>
        <p>
          Esta politica explica como Korvi recopila, usa, protege y conserva la informacion
          necesaria para reportes viales, mapas de riesgo, alertas, seguimiento institucional
          y seguridad de la cuenta.
        </p>
        <span>Ultima actualizacion: 16 de junio de 2026</span>
      </header>

      <section class="privacy-layout">
        <aside class="privacy-index" aria-label="Contenido">
          <a href="#alcance">Alcance</a>
          <a href="#datos">Datos que recopilamos</a>
          <a href="#uso">Como usamos la informacion</a>
          <a href="#ubicacion">Ubicacion y evidencias</a>
          <a href="#compartir">Con quien compartimos</a>
          <a href="#seguridad">Seguridad</a>
          <a href="#derechos">Tus derechos</a>
          <a href="#contacto">Contacto</a>
        </aside>

        <article class="privacy-content">
          <section id="alcance">
            <h2>1. Alcance de esta politica</h2>
            <p>
              Esta politica aplica al sitio web, panel administrativo, mapa de reportes,
              formularios de contacto, autenticacion y cualquier modulo de Korvi que permita
              crear, consultar o gestionar reportes de movilidad y seguridad vial.
            </p>
            <p>
              Al usar Korvi aceptas que tratemos tu informacion de acuerdo con esta politica
              y con las finalidades operativas descritas aqui.
            </p>
          </section>

          <section id="datos">
            <h2>2. Datos que podemos recopilar</h2>
            <div class="policy-grid">
              <div>
                <h3>Cuenta y perfil</h3>
                <p>Nombre, correo, rol, institucion asociada, estado de cuenta y preferencias basicas.</p>
              </div>
              <div>
                <h3>Reportes ciudadanos</h3>
                <p>Titulo, descripcion, categoria, nivel de riesgo, estado, comentarios y fecha de creacion.</p>
              </div>
              <div>
                <h3>Ubicacion</h3>
                <p>Coordenadas, provincia, municipio, interseccion o direccion relacionada con un reporte.</p>
              </div>
              <div>
                <h3>Evidencias</h3>
                <p>Imagenes cargadas por usuarios para documentar incidentes, obstaculos o condiciones de riesgo.</p>
              </div>
              <div>
                <h3>Uso tecnico</h3>
                <p>Registros de acceso, errores, eventos de actividad, dispositivo, navegador e informacion de seguridad.</p>
              </div>
              <div>
                <h3>Comunicaciones</h3>
                <p>Solicitudes de demo, mensajes de soporte, respuestas administrativas y seguimiento operativo.</p>
              </div>
            </div>
          </section>

          <section id="uso">
            <h2>3. Como usamos la informacion</h2>
            <ul>
              <li>Mostrar reportes en mapas de riesgo y listas operativas.</li>
              <li>Validar, priorizar, asignar y dar seguimiento a incidentes viales.</li>
              <li>Generar alertas, rutas con contexto y recomendaciones de seguridad.</li>
              <li>Coordinar respuestas con instituciones, moderadores o equipos autorizados.</li>
              <li>Prevenir abuso, spam, accesos no autorizados y uso indebido de la plataforma.</li>
              <li>Mejorar el rendimiento, disponibilidad, calidad y estabilidad del servicio.</li>
            </ul>
          </section>

          <section id="ubicacion">
            <h2>4. Ubicacion, fotos y datos sensibles</h2>
            <p>
              La ubicacion se usa para ubicar incidentes, calcular cercania, presentar mapas y
              ayudar a otros usuarios a tomar mejores decisiones de movilidad. Si activas GPS,
              el navegador puede solicitar permiso antes de compartir tu posicion.
            </p>
            <p>
              Las imagenes de evidencia deben enfocarse en el riesgo vial. Evita subir fotos que
              expongan rostros, placas, documentos, menores de edad o informacion privada que no
              sea necesaria para atender el reporte.
            </p>
          </section>

          <section id="compartir">
            <h2>5. Con quien podemos compartir datos</h2>
            <p>
              Korvi puede compartir informacion de reportes con usuarios autorizados, instituciones,
              moderadores, administradores y proveedores tecnicos necesarios para operar la plataforma.
              No vendemos datos personales.
            </p>
            <p>
              Tambien podemos divulgar informacion si es requerida por ley, una autoridad competente
              o para proteger la seguridad de usuarios, infraestructura o comunidades.
            </p>
          </section>

          <section id="seguridad">
            <h2>6. Seguridad y conservacion</h2>
            <p>
              Aplicamos controles razonables para proteger datos, incluyendo autenticacion, roles,
              permisos, registros de actividad y separacion de accesos administrativos. Ningun sistema
              es absolutamente infalible, pero trabajamos para reducir riesgos y responder a incidentes.
            </p>
            <p>
              Conservamos informacion mientras sea necesaria para operar Korvi, cumplir obligaciones,
              auditar reportes, resolver disputas, prevenir abuso o mantener historiales operativos.
            </p>
          </section>

          <section id="derechos">
            <h2>7. Tus derechos y opciones</h2>
            <ul>
              <li>Solicitar acceso a informacion asociada a tu cuenta.</li>
              <li>Pedir correccion de datos incompletos o incorrectos.</li>
              <li>Solicitar eliminacion o desactivacion cuando corresponda.</li>
              <li>Revocar permisos del navegador, como ubicacion o camara, desde tu dispositivo.</li>
              <li>Contactarnos para dudas sobre privacidad, seguridad o tratamiento de datos.</li>
            </ul>
          </section>

          <section id="contacto">
            <h2>8. Contacto</h2>
            <p>
              Para solicitudes relacionadas con privacidad, escribe a
              <a href="mailto:contacto@korvi.local">contacto@korvi.local</a>. Incluye tu nombre,
              correo asociado y una descripcion clara de la solicitud.
            </p>
          </section>

          <section class="notice">
            <h2>Nota importante</h2>
            <p>
              Esta pagina es una politica base para el producto Korvi. Debe revisarse con asesoria
              legal antes de usarse como documento contractual definitivo en una jurisdiccion especifica.
            </p>
          </section>
        </article>
      </section>
    </main>
  `,
  styleUrls: ['./privacy-policy.component.css'],
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngOnInit(): void {
    this.document.body.classList.add('rs-landing-page');
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('rs-landing-page');
  }
}
