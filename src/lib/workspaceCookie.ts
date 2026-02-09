import { STORAGE_KEYS } from '@/constants/storageKeys';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const readWorkspaceCookie = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${STORAGE_KEYS.workspaceCookie}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) {
    return null;
  }

  return decodeURIComponent(entry.slice(prefix.length)) || null;
};

export const persistWorkspaceCookie = (workspaceId: string) => {
  if (typeof document === 'undefined' || !workspaceId) {
    return;
  }

  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';

  document.cookie = `${STORAGE_KEYS.workspaceCookie}=${encodeURIComponent(
    workspaceId
  )}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};
