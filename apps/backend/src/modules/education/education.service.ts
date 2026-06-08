import { Injectable, NotFoundException } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { User } from "../users/user.entity";
import { CompleteLessonDto } from "./dto/complete-lesson.dto";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { SaveLessonProgressDto } from "./dto/save-lesson-progress.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";
import { EDUCATION_CATEGORIES } from "./education-categories.catalog";
import { Lesson } from "./entities/lesson.entity";
import { UserProgress } from "./entities/user-progress.entity";

@Injectable()
export class EducationService {
  constructor(
    @InjectRepository(Lesson) private readonly lessonsRepo: Repository<Lesson>,
    @InjectRepository(UserProgress)
    private readonly progressRepo: Repository<UserProgress>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async findLessons() {
    const count = await this.lessonsRepo.count();
    if (count === 0) await this.seedDefaultLessons();
    else await this.ensureDefaultLessonContent();
    return this.lessonsRepo.find({
      where: { isActive: true },
      order: { createdAt: "ASC" },
    });
  }

  async findLesson(id: string) {
    await this.ensureDefaultLessonContent();
    const lesson = await this.lessonsRepo.findOne({
      where: { id, isActive: true },
    });
    if (!lesson) throw new NotFoundException("Leccion no encontrada");
    return lesson;
  }

  findCategories() {
    return EDUCATION_CATEGORIES.map((name) => ({ name }));
  }

  async youtubeMetadata(url: string) {
    const videoId = this.youtubeVideoId(url);
    if (!videoId) throw new BadRequestException("URL de YouTube no valida");

    const [oembed, player] = await Promise.all([
      this.fetchYoutubeOEmbed(videoId),
      this.fetchYoutubePlayerMetadata(videoId),
    ]);
    const durationSeconds = player.durationSeconds;

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`,
      title: oembed.title || player.title || "Video de YouTube",
      description: player.description,
      authorName: oembed.authorName,
      providerName: oembed.providerName || "YouTube",
      thumbnailUrl:
        oembed.thumbnailUrl ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      durationSeconds,
      durationMinutes: durationSeconds
        ? Math.max(1, Math.ceil(durationSeconds / 60))
        : undefined,
    };
  }

  async createLesson(dto: CreateLessonDto) {
    const metadata = dto.videoUrl
      ? await this.optionalYoutubeMetadata(dto.videoUrl)
      : null;
    return this.lessonsRepo.save(
      this.lessonsRepo.create({
        title: dto.title || metadata?.title,
        content: dto.content || metadata?.description || "",
        category: dto.category,
        courseTitle: dto.courseTitle,
        videoUrl: metadata?.url ?? dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl || metadata?.thumbnailUrl,
        durationMinutes: dto.durationMinutes ?? metadata?.durationMinutes ?? 8,
        points: dto.points ?? 10,
      }),
    );
  }

  async updateLesson(id: string, dto: UpdateLessonDto) {
    const lesson = await this.findLesson(id);
    const metadata = dto.videoUrl
      ? await this.optionalYoutubeMetadata(dto.videoUrl)
      : null;
    this.lessonsRepo.merge(lesson, {
      title: dto.title ?? lesson.title,
      content: dto.content ?? lesson.content,
      category: dto.category ?? lesson.category,
      courseTitle: dto.courseTitle ?? lesson.courseTitle,
      videoUrl: metadata?.url ?? dto.videoUrl ?? lesson.videoUrl,
      thumbnailUrl:
        dto.thumbnailUrl ?? metadata?.thumbnailUrl ?? lesson.thumbnailUrl,
      durationMinutes:
        dto.durationMinutes ??
        metadata?.durationMinutes ??
        lesson.durationMinutes,
      points: dto.points ?? lesson.points,
    });
    return this.lessonsRepo.save(lesson);
  }

  async completeLesson(
    lessonId: string,
    userId: string,
    dto: CompleteLessonDto,
  ) {
    const progress = await this.getOrCreateUserProgress(lessonId, userId);
    progress.completed = true;
    progress.progressPercent = 100;
    progress.score = dto.score;
    progress.completedAt = new Date();
    progress.lastAccessedAt = new Date();
    return this.progressRepo.save(progress);
  }

  async saveLessonProgress(
    lessonId: string,
    userId: string,
    dto: SaveLessonProgressDto,
  ) {
    const progress = await this.getOrCreateUserProgress(lessonId, userId);
    progress.progressPercent = Math.max(
      progress.progressPercent,
      dto.progressPercent,
    );
    progress.lastAccessedAt = new Date();
    if (progress.progressPercent >= 100) {
      progress.completed = true;
      progress.completedAt = progress.completedAt ?? new Date();
    }
    return this.progressRepo.save(progress);
  }

  async getProgress(userId: string) {
    return this.progressRepo.find({
      where: { user: { id: userId } },
      order: { updatedAt: "DESC" },
    });
  }

  private async getOrCreateUserProgress(lessonId: string, userId: string) {
    const lesson = await this.lessonsRepo.findOneBy({ id: lessonId });
    if (!lesson) throw new NotFoundException("Leccion no encontrada");

    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const existing = await this.progressRepo.findOne({
      where: { user: { id: userId }, lesson: { id: lessonId } },
    });

    return existing ?? this.progressRepo.create({ user, lesson });
  }

  private async optionalYoutubeMetadata(url: string) {
    return this.youtubeVideoId(url) ? this.youtubeMetadata(url) : null;
  }

  private youtubeVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be")
        return this.validYoutubeId(parsed.pathname.slice(1));
      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        if (parsed.pathname === "/watch")
          return this.validYoutubeId(parsed.searchParams.get("v") ?? "");
        const match = parsed.pathname.match(
          /^\/(?:embed|shorts|live)\/([^/?#]+)/,
        );
        return match ? this.validYoutubeId(match[1]) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private validYoutubeId(id: string): string | null {
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  private async fetchYoutubeOEmbed(videoId: string) {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
    );
    if (!response.ok) {
      return {
        title: "",
        authorName: undefined,
        providerName: "YouTube",
        thumbnailUrl: undefined,
      };
    }

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      provider_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title ?? "",
      authorName: data.author_name,
      providerName: data.provider_name,
      thumbnailUrl: data.thumbnail_url,
    };
  }

  private async fetchYoutubePlayerMetadata(videoId: string) {
    const apiKey = this.config.get<string>("YOUTUBE_API_KEY", "").trim();
    if (apiKey) {
      const fromApi = await this.fetchYoutubeDataApiMetadata(videoId, apiKey);
      if (fromApi.durationSeconds) return fromApi;
    }

    const response = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240501.00.00",
            },
          },
          videoId,
        }),
      },
    );
    if (!response.ok) {
      return { title: "", description: undefined, durationSeconds: undefined };
    }

    const data = (await response.json()) as {
      videoDetails?: {
        title?: string;
        shortDescription?: string;
        lengthSeconds?: string;
      };
    };
    const durationSeconds = Number(data.videoDetails?.lengthSeconds);
    return {
      title: data.videoDetails?.title ?? "",
      description: data.videoDetails?.shortDescription?.trim() || undefined,
      durationSeconds: Number.isFinite(durationSeconds)
        ? durationSeconds
        : undefined,
    };
  }

  private async fetchYoutubeDataApiMetadata(videoId: string, apiKey: string) {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`,
    );
    if (!response.ok) {
      return { title: "", description: undefined, durationSeconds: undefined };
    }

    const data = (await response.json()) as {
      items?: Array<{
        snippet?: { title?: string; description?: string };
        contentDetails?: { duration?: string };
      }>;
    };
    const item = data.items?.[0];
    return {
      title: item?.snippet?.title ?? "",
      description: item?.snippet?.description?.trim() || undefined,
      durationSeconds: item?.contentDetails?.duration
        ? this.isoDurationToSeconds(item.contentDetails.duration)
        : undefined,
    };
  }

  private isoDurationToSeconds(duration: string): number | undefined {
    const match = duration.match(
      /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
    );
    if (!match) return undefined;
    const [, days, hours, minutes, seconds] = match;
    return (
      Number(days ?? 0) * 86400 +
      Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)
    );
  }

  private async seedDefaultLessons() {
    const helmetDocumentation = `
      <h2>Objetivo de la leccion</h2>
      <p>El casco es el principal elemento de proteccion para motociclistas y pasajeros. Su funcion es absorber parte de la energia del impacto, proteger el craneo y reducir lesiones graves en caidas o colisiones.</p>
      <img src="/uploads/education/casco-ajuste.jpg" alt="Motociclista usando casco correctamente ajustado" />
      <h2>Como debe usarse</h2>
      <ul>
        <li><strong>Posicion:</strong> debe quedar recto y cubrir la frente sin bloquear la vision.</li>
        <li><strong>Correa:</strong> siempre abrochada y ajustada bajo la barbilla.</li>
        <li><strong>Talla:</strong> no debe moverse libremente al girar la cabeza.</li>
        <li><strong>Visor:</strong> limpio, sin rayas profundas y cerrado cuando sea necesario.</li>
      </ul>
      <h2>Antes de conducir</h2>
      <p>Revisa que el casco no tenga grietas, deformaciones o golpes fuertes previos. Si participo en un accidente, debe reemplazarse aunque parezca estar en buen estado.</p>
      <img src="/uploads/education/casco-checklist.jpg" alt="Grupo de motociclistas con casco y equipo de seguridad" />
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
    const phoneDocumentation = this.phoneUseDocumentation();
    const safetyFirstDocumentation = this.safetyFirstDocumentation();

    await this.lessonsRepo.save([
      this.lessonsRepo.create({
        title: "Uso correcto del casco",
        category: "Motociclistas",
        points: 50,
        content: helmetDocumentation,
      }),
      this.lessonsRepo.create({
        title: "No usar celular al conducir",
        category: "Conductores",
        points: 40,
        content: phoneDocumentation,
      }),
      this.lessonsRepo.create({
        title: "Tu seguridad es lo primero",
        category: "Seguridad vial",
        points: 40,
        content: safetyFirstDocumentation,
      }),
      this.lessonsRepo.create({
        title: "Respeto al peatón",
        category: "Peatones y conductores",
        points: 40,
        content:
          "Los cruces peatonales y semáforos deben respetarse para proteger vidas.",
      }),
    ]);
  }

  private async ensureDefaultLessonContent() {
    const phoneLessons = await this.lessonsRepo.find({
      where: { title: ILike("%celular%") },
    });
    for (const phoneLesson of phoneLessons) {
      if (phoneLesson.content.includes("celular-conduccion-distraida.jpg"))
        continue;
      phoneLesson.content = this.phoneUseDocumentation();
      phoneLesson.durationMinutes = Math.max(
        phoneLesson.durationMinutes ?? 0,
        8,
      );
      await this.lessonsRepo.save(phoneLesson);
    }

    const safetyLessons = await this.lessonsRepo.find({
      where: { title: ILike("%seguridad%") },
    });
    for (const safetyLesson of safetyLessons) {
      const normalizedTitle = this.normalizeText(safetyLesson.title);
      if (
        !normalizedTitle.includes("seguridad") ||
        !normalizedTitle.includes("primero")
      )
        continue;
      if (safetyLesson.content.includes("seguridad-cinturon.jpg")) continue;
      safetyLesson.content = this.safetyFirstDocumentation();
      safetyLesson.durationMinutes = Math.max(
        safetyLesson.durationMinutes ?? 0,
        8,
      );
      await this.lessonsRepo.save(safetyLesson);
    }
  }

  private phoneUseDocumentation() {
    return `
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
  }

  private safetyFirstDocumentation() {
    return `
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
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
}
