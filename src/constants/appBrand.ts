export const APP_BRAND = {
  name: 'Attendly',
  owner: 'Mirza Polat',
  slug: 'attendly',
  logoPath: '/app-logo.svg',
  repositoryUrl: 'https://github.com/mirzapolat/attendly',
} as const;

export const APP_NAME = APP_BRAND.name;
export const APP_OWNER = APP_BRAND.owner;
export const APP_SLUG = APP_BRAND.slug;
export const APP_LOGO_PATH = APP_BRAND.logoPath;
export const APP_REPOSITORY_URL = APP_BRAND.repositoryUrl;
export const APP_TITLE = `${APP_NAME} by ${APP_OWNER}`;

export const appPageTitle = (section: string) => `${section} - ${APP_NAME}`;
export const appStorageKey = (key: string) => `${APP_SLUG}:${key}`;
export const appCookieKey = (key: string) => `${APP_SLUG}_${key}`;
export const appMimeType = (key: string) => `application/x-${APP_SLUG}-${key}`;
