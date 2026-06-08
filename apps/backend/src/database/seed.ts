import "reflect-metadata";
import * as bcrypt from "bcrypt";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { DataSource } from "typeorm";
import { UserRole } from "../common/enums/user-role.enum";
import { InstitutionType } from "../common/enums/institution-type.enum";
import { ReportCategory } from "../common/enums/report-category.enum";
import { ReportStatus } from "../common/enums/report-status.enum";
import { Lesson } from "../modules/education/entities/lesson.entity";
import { ReportConfirmation } from "../modules/reports/entities/report-confirmation.entity";
import { Report } from "../modules/reports/entities/report.entity";
import { Institution } from "../modules/institutions/institution.entity";
import { User } from "../modules/users/user.entity";
import { ReportPhoto } from "../modules/reports/entities/report-photo.entity";
import { StatusHistory } from "../modules/reports/entities/status-history.entity";
import { Quiz } from "../modules/education/entities/quiz.entity";
import { UserProgress } from "../modules/education/entities/user-progress.entity";

function loadLocalEnv() {
  const envPath = join(__dirname, "../../.env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= value;
  }
}

loadLocalEnv();

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? "ruta_segura",
  password: process.env.DB_PASSWORD ?? "ruta_segura_pwd",
  database: process.env.DB_NAME ?? "ruta_segura_rd",
  synchronize: true,
  entities: [
    User,
    Institution,
    Report,
    ReportPhoto,
    ReportConfirmation,
    StatusHistory,
    Lesson,
    Quiz,
    UserProgress,
  ],
});

async function run() {
  await dataSource.initialize();
  const usersRepo = dataSource.getRepository(User);
  const institutionsRepo = dataSource.getRepository(Institution);
  const reportsRepo = dataSource.getRepository(Report);
  const lessonsRepo = dataSource.getRepository(Lesson);

  const passwordHash = await bcrypt.hash("Demo12345", 12);
  const requestedAdminPasswordHash = await bcrypt.hash("demo1234", 12);

  async function upsertInstitution(
    data: Partial<Institution> & Pick<Institution, "name" | "type">,
  ) {
    const existing = await institutionsRepo.findOne({
      where: { name: data.name },
    });
    return institutionsRepo.save(
      existing
        ? institutionsRepo.merge(existing, data)
        : institutionsRepo.create(data),
    );
  }

  async function upsertUser(
    data: Partial<User> & Pick<User, "email" | "fullName" | "role">,
  ) {
    const existing = await usersRepo
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("LOWER(user.email) = LOWER(:email)", { email: data.email })
      .getOne();

    return usersRepo.save(
      existing ? usersRepo.merge(existing, data) : usersRepo.create(data),
    );
  }

  async function createLessonIfMissing(
    data: Pick<Lesson, "title" | "category" | "content" | "points">,
  ) {
    const existing = await lessonsRepo.findOne({
      where: { title: data.title },
    });
    return existing
      ? lessonsRepo.save(lessonsRepo.merge(existing, data))
      : lessonsRepo.save(lessonsRepo.create(data));
  }

  async function createReportIfMissing(
    data: Partial<Report> &
      Pick<
        Report,
        | "title"
        | "category"
        | "description"
        | "latitude"
        | "longitude"
        | "createdBy"
      >,
  ) {
    const existing = await reportsRepo.findOne({
      where: { title: data.title },
    });
    return reportsRepo.save(
      existing ? reportsRepo.merge(existing, data) : reportsRepo.create(data),
    );
  }

  const digesett = await upsertInstitution({
    name: "DIGESETT",
    type: InstitutionType.TRANSIT_AUTHORITY,
    province: "Distrito Nacional",
    municipality: "Santo Domingo",
    coverageArea: "Control y seguridad vial nacional.",
  });

  const ayuntamiento = await upsertInstitution({
    name: "Ayuntamiento Santo Domingo Este",
    type: InstitutionType.MUNICIPALITY,
    province: "Santo Domingo",
    municipality: "Santo Domingo Este",
    coverageArea: "Gestion municipal de Santo Domingo Este.",
  });

  const admin = await upsertUser({
    fullName: "Administrador",
    email: "jadelarosapaulino@gmail.com",
    passwordHash: requestedAdminPasswordHash,
    role: UserRole.SUPER_ADMIN,
    province: "Distrito Nacional",
    municipality: "Santo Domingo",
    isActive: true,
    activatedAt: new Date(),
    mustChangePassword: true,
  });

  await upsertUser({
    fullName: "Operador Institucional Demo",
    email: "institucion@demo.com",
    passwordHash,
    role: UserRole.INSTITUTION_ADMIN,
    province: "Santo Domingo",
    municipality: "Santo Domingo Este",
    institution: ayuntamiento,
    institutionRole: "Coordinador operativo",
  });

  await upsertUser({
    fullName: "Moderador DIGESETT Demo",
    email: "digesett@demo.com",
    passwordHash,
    role: UserRole.MODERATOR,
    province: "Distrito Nacional",
    municipality: "Santo Domingo",
    institution: digesett,
    institutionRole: "Supervisor vial",
  });

  const citizen = await upsertUser({
    fullName: "Ciudadano Demo",
    email: "ciudadano@demo.com",
    passwordHash,
    role: UserRole.CITIZEN,
    province: "Distrito Nacional",
    municipality: "Santo Domingo",
    vehicleType: "Motocicleta",
  });

  const helmetDocumentation = `
    <h2>Objetivo de la leccion</h2>
    <p>El casco es el principal elemento de proteccion para motociclistas y pasajeros. Su funcion es absorber parte de la energia del impacto, proteger el craneo y reducir lesiones graves en caidas o colisiones.</p>
    <img src="/uploads/education/casco-ajuste.svg" alt="Ajuste correcto del casco" />
    <h2>Como debe usarse</h2>
    <ul>
      <li><strong>Posicion:</strong> debe quedar recto y cubrir la frente sin bloquear la vision.</li>
      <li><strong>Correa:</strong> siempre abrochada y ajustada bajo la barbilla.</li>
      <li><strong>Talla:</strong> no debe moverse libremente al girar la cabeza.</li>
      <li><strong>Visor:</strong> limpio, sin rayas profundas y cerrado cuando sea necesario.</li>
    </ul>
    <h2>Antes de conducir</h2>
    <p>Revisa que el casco no tenga grietas, deformaciones o golpes fuertes previos. Si participo en un accidente, debe reemplazarse aunque parezca estar en buen estado.</p>
    <img src="/uploads/education/casco-checklist.svg" alt="Checklist de seguridad del casco" />
    <h2>Errores frecuentes</h2>
    <ul>
      <li>Llevar el casco en el brazo o sin abrochar.</li>
      <li>Usar cascos decorativos o sin certificacion.</li>
      <li>Compartir un casco que no corresponde a la talla del usuario.</li>
      <li>Usar visores oscuros de noche o con lluvia intensa.</li>
    </ul>
    <h2>Mensaje clave</h2>
    <p>Un casco certificado, ajustado y abrochado correctamente puede marcar la diferencia entre una lesion leve y una emergencia critica.</p>
  `.trim();
  const phoneDocumentation = `
    <h2>Objetivo de la leccion</h2>
    <p>Usar el celular mientras se conduce divide la atención visual, manual y mental. Aunque el vehículo avance pocos segundos sin mirada plena al camino, la distancia recorrida puede ser suficiente para no ver un peatón, un motor, un semáforo o un obstáculo repentino.</p>
    <img src="/uploads/education/celular-conduccion-distraida.jpg" alt="Conducción distraída por uso del celular" />
    <h2>Por que aumenta el riesgo</h2>
    <ul>
      <li><strong>Atención visual:</strong> mirar una pantalla impide detectar cambios en el tránsito.</li>
      <li><strong>Atención manual:</strong> escribir, desbloquear o buscar una aplicación reduce el control del volante.</li>
      <li><strong>Atención mental:</strong> una conversación o mensaje hace que el conductor tarde más en reaccionar.</li>
      <li><strong>Falsa confianza:</strong> revisar el celular "solo un segundo" suele tomar más tiempo del que el conductor percibe.</li>
    </ul>
    <h2>Conductas que deben evitarse</h2>
    <p>No escribas mensajes, no revises redes sociales, no grabes videos y no manipules navegación o música mientras el vehículo está en movimiento. Si necesitas responder, estaciona en un lugar seguro antes de tocar el teléfono.</p>
    <img src="/uploads/education/celular-no-texting-senal.jpg" alt="Senal de no textear mientras se conduce" />
    <h2>Practicas recomendadas</h2>
    <ul>
      <li>Configura la ruta, música y llamadas antes de iniciar el viaje.</li>
      <li>Activa el modo no molestar o modo conducción del teléfono.</li>
      <li>Usa un soporte fijo si necesitas navegación, sin manipularlo durante la marcha.</li>
      <li>Designa a un pasajero para responder mensajes urgentes.</li>
      <li>Si el mensaje es importante, detente fuera del carril y enciende las luces intermitentes.</li>
    </ul>
    <h2>Mensaje clave</h2>
    <p>La conducción segura exige ojos en la vía, manos en el volante y mente en el tránsito. Ningún mensaje vale más que llegar con vida.</p>
  `.trim();
  const safetyFirstDocumentation = `
    <h2>Objetivo de la leccion</h2>
    <p>La seguridad vial empieza antes de mover el vehículo. Prepararte, revisar tu entorno y anticipar riesgos reduce la posibilidad de lesiones, siniestros y decisiones apresuradas en la vía.</p>
    <img src="/uploads/education/seguridad-cinturon.jpg" alt="Recordatorio de abrochar el cinturon de seguridad" />
    <h2>Antes de salir</h2>
    <ul>
      <li><strong>Cinturón o casco:</strong> usa siempre el equipo de protección correspondiente a tu vehículo.</li>
      <li><strong>Estado del vehículo:</strong> revisa luces, frenos, gomas, espejos y combustible.</li>
      <li><strong>Ruta:</strong> identifica zonas de congestion, lluvia, obras, escuelas o cruces peligrosos.</li>
      <li><strong>Condicion personal:</strong> evita conducir con sueno, alcohol, medicamentos que afecten reflejos o estres intenso.</li>
    </ul>
    <h2>Durante el trayecto</h2>
    <p>Mantén una distancia segura, respeta los límites de velocidad y reduce la marcha antes de intersecciones, pasos peatonales, curvas y zonas con baja visibilidad. La prioridad no es llegar rápido, sino llegar completo.</p>
    <img src="/uploads/education/seguridad-cruce-peatonal.jpg" alt="Cruce peatonal y control de tránsito urbano" />
    <h2>Senales de alerta</h2>
    <ul>
      <li>Peatones cerca de la acera o cruzando fuera de señalización.</li>
      <li>Motocicletas filtrando entre carriles o vehículos detenidos repentinamente.</li>
      <li>Semáforos intermitentes, apagados o con visibilidad obstruida.</li>
      <li>Charcos, hoyos, grava, aceite o basura en la via.</li>
      <li>Conductores usando celular o haciendo maniobras impredecibles.</li>
    </ul>
    <h2>Habitos que protegen</h2>
    <ul>
      <li>Conduce a una velocidad que te permita frenar sin invadir otro carril.</li>
      <li>Usa direccionales con anticipacion y verifica espejos antes de cambiar de carril.</li>
      <li>Cede el paso cuando la duda pueda generar conflicto.</li>
      <li>No compitas por espacio con vehículos pesados o motocicletas.</li>
      <li>Reporta riesgos viales desde un lugar seguro, nunca mientras conduces.</li>
    </ul>
    <h2>Mensaje clave</h2>
    <p>Tu seguridad es lo primero cuando cada decisión reduce exposición al riesgo: prepararte, observar, anticipar y actuar con calma salva vidas.</p>
  `.trim();

  await createLessonIfMissing({
    title: "Uso correcto del casco",
    category: "Motociclistas",
    content: helmetDocumentation,
    points: 50,
  });

  await createLessonIfMissing({
    title: "No manejar usando celular",
    category: "Conductores",
    content: phoneDocumentation,
    points: 40,
  });

  await createLessonIfMissing({
    title: "Tu seguridad es lo primero",
    category: "Seguridad vial",
    content: safetyFirstDocumentation,
    points: 40,
  });

  const demoReports: Array<
    Partial<Report> &
      Pick<
        Report,
        | "title"
        | "category"
        | "description"
        | "latitude"
        | "longitude"
        | "createdBy"
      >
  > = [
    {
      title: "Semáforo dañado en avenida principal",
      category: ReportCategory.TRAFFIC_LIGHT_DAMAGED,
      description: "Semáforo fuera de servicio en hora pico.",
      latitude: 18.4861,
      longitude: -69.9312,
      province: "Distrito Nacional",
      municipality: "Santo Domingo",
      riskLevel: 5,
      status: ReportStatus.PENDING,
      createdBy: citizen,
    },
    {
      title: "Hoyo profundo cerca de escuela",
      category: ReportCategory.ROAD_DAMAGE,
      description: "Hoyo en carril derecho, riesgo para motores.",
      latitude: 18.5001,
      longitude: -69.9205,
      province: "Distrito Nacional",
      municipality: "Santo Domingo",
      riskLevel: 4,
      status: ReportStatus.VALIDATED,
      createdBy: admin,
    },
    {
      title: "Escombros bloqueando un carril",
      category: ReportCategory.ROAD_OBSTRUCTION,
      description:
        "Acumulacion de escombros y basura reduce la movilidad y obliga a maniobras peligrosas.",
      latitude: 18.4934,
      longitude: -69.9298,
      province: "Distrito Nacional",
      municipality: "Santo Domingo de Guzman",
      address: "Av. Maximo Gomez",
      riskLevel: 4,
      status: ReportStatus.PENDING,
      createdBy: citizen,
    },
    {
      title: "Calle muy oscura",
      category: ReportCategory.POOR_LIGHTING,
      description:
        "Tramo con poca iluminación y baja visibilidad para peatones.",
      latitude: 18.4739888,
      longitude: -69.8513593,
      province: "Distrito Nacional",
      municipality: "Santo Domingo Este",
      riskLevel: 4,
      status: ReportStatus.PENDING,
      createdBy: citizen,
    },
    {
      title: "Cruce peatonal peligroso",
      category: ReportCategory.DANGEROUS_CROSSING,
      description:
        "Vehículos no reducen velocidad en una zona de alto flujo peatonal.",
      latitude: 18.4810253,
      longitude: -69.8546791,
      province: "Distrito Nacional",
      municipality: "Santo Domingo Este",
      riskLevel: 4,
      status: ReportStatus.PENDING,
      createdBy: citizen,
    },
    {
      title: "Senal de pare ausente",
      category: ReportCategory.MISSING_SIGNAGE,
      description: "Intersección sin señalización clara para ordenar el paso.",
      latitude: 18.4924403,
      longitude: -69.8519308,
      province: "Distrito Nacional",
      municipality: "Santo Domingo Este",
      riskLevel: 3,
      status: ReportStatus.IN_PROGRESS,
      createdBy: admin,
    },
    {
      title: "Maniobras imprudentes frecuentes",
      category: ReportCategory.RECKLESS_DRIVING,
      description:
        "Conductores cambian de carril sin precaucion cerca de una avenida principal.",
      latitude: 18.4887,
      longitude: -69.9024,
      province: "Distrito Nacional",
      municipality: "Santo Domingo",
      riskLevel: 5,
      status: ReportStatus.VALIDATED,
      createdBy: citizen,
    },
  ];

  for (const report of demoReports) {
    await createReportIfMissing(report);
  }

  await dataSource.destroy();
  console.log(
    "Seed completado. Admin: jadelarosapaulino@gmail.com / demo1234 (debe cambiarla)",
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
