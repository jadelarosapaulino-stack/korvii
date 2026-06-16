import { buildEnv } from './build-env';

export const API_URL = buildEnv.apiUrl;
export const REALTIME_URL = buildEnv.realtimeUrl || window.location.origin;
