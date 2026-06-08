import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from './api.config';

export interface Lesson {
  id: string;
  title: string;
  content: string;
  category: string;
  courseTitle?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationMinutes: number;
  points: number;
}

export interface CreateLessonPayload {
  title: string;
  content: string;
  category: string;
  courseTitle?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  points?: number;
}

export interface YoutubeVideoMetadata {
  videoId: string;
  url: string;
  embedUrl: string;
  title: string;
  description?: string;
  authorName?: string;
  providerName: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  durationMinutes?: number;
}

export interface EducationCategory {
  name: string;
}

export interface LessonProgress {
  id: string;
  completed: boolean;
  progressPercent: number;
  score: number;
  completedAt?: string;
  lastAccessedAt?: string;
  lesson: Lesson;
}

@Injectable({ providedIn: 'root' })
export class EducationService {
  constructor(private readonly http: HttpClient) {}

  lessons() {
    return this.http.get<Lesson[]>(`${API_URL}/education/lessons`);
  }

  lesson(id: string) {
    return this.http.get<Lesson>(`${API_URL}/education/lessons/${id}`);
  }

  categories() {
    return this.http.get<EducationCategory[]>(`${API_URL}/education/categories`);
  }

  youtubeMetadata(url: string) {
    return this.http.get<YoutubeVideoMetadata>(`${API_URL}/education/youtube/metadata`, {
      params: { url },
    });
  }

  createLesson(payload: CreateLessonPayload | FormData) {
    return this.http.post<Lesson>(`${API_URL}/education/lessons`, payload);
  }

  updateLesson(id: string, payload: CreateLessonPayload | FormData) {
    return this.http.patch<Lesson>(`${API_URL}/education/lessons/${id}`, payload);
  }

  uploadContentImage(file: File) {
    const data = new FormData();
    data.append('image', file, file.name);
    return this.http.post<{ url: string }>(`${API_URL}/education/uploads/images`, data);
  }

  completeLesson(id: string, score: number) {
    return this.http.post<LessonProgress>(`${API_URL}/education/lessons/${id}/complete`, { score });
  }

  saveLessonProgress(id: string, progressPercent: number) {
    return this.http.post<LessonProgress>(`${API_URL}/education/lessons/${id}/progress`, { progressPercent });
  }

  myProgress() {
    return this.http.get<LessonProgress[]>(`${API_URL}/education/progress/me`);
  }
}
