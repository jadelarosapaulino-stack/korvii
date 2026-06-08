import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { REALTIME_URL } from './api.config';

export type RealtimeEventType =
  | 'report.created'
  | 'report.updated'
  | 'report.status_changed'
  | 'report.assigned'
  | 'report.metrics_changed'
  | 'weather.flood_zone_created';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  occurredAt: string;
  reportId?: string;
  status?: string;
  category?: string;
  riskLevel?: number;
  province?: string | null;
  municipality?: string | null;
  assignedToId?: string | null;
  institutionId?: string | null;
  rooms?: string[];
  data?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private socket?: Socket;

  on(event: RealtimeEventType): Observable<RealtimeEventPayload> {
    return new Observable((observer) => {
      const socket = this.connect();
      const handler = (payload: RealtimeEventPayload) => observer.next(payload);
      socket.on(event, handler);
      return () => socket.off(event, handler);
    });
  }

  private connect(): Socket {
    if (this.socket?.connected || this.socket?.active) return this.socket;

    const token = localStorage.getItem('ruta_segura_token');
    this.socket = io(REALTIME_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      autoConnect: Boolean(token),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
