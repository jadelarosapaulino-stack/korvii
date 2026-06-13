import { environment } from '../../environments/environment';

export const API_URL = environment.apiUrl;
export const REALTIME_URL = environment.realtimeUrl || window.location.origin;
