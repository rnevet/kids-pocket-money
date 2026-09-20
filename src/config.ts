export interface AppConfig {
  clientId: string;
  apiKey: string;
  appId: string;
  appUrl: string;
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

export function loadConfig(env: Record<string, string | undefined> = import.meta.env): AppConfig {
  return {
    clientId: required('VITE_GOOGLE_CLIENT_ID', env.VITE_GOOGLE_CLIENT_ID),
    apiKey: required('VITE_GOOGLE_API_KEY', env.VITE_GOOGLE_API_KEY),
    appId: required('VITE_GOOGLE_APP_ID', env.VITE_GOOGLE_APP_ID),
    appUrl: typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`,
  };
}

export const OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file';
