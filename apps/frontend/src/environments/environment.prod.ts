export const environment = {
  apiUrl: process.env['NG_APP_API_URL'] || 'http://localhost:3000/api',
  realtimeUrl: process.env['REALTIME_URL'] || 'http://localhost:3001',
  maptilerKey: process.env['MAPTILER_KEY'] || '',
};
