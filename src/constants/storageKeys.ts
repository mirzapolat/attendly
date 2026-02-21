import { appCookieKey, appStorageKey } from '@/constants/appBrand';

export const STORAGE_KEYS = {
  workspaceId: appStorageKey('workspace'),
  workspaceCookie: appCookieKey('workspace'),
  themeColor: appStorageKey('theme-color'),
  resumeEventPrefix: `${appStorageKey('resume-event')}:`,
  clientId: appStorageKey('client-id'),
  qrHostTabId: appStorageKey('qr-host-tab-id'),
  eventsView: appStorageKey('events-view'),
  welcome: appStorageKey('welcome'),
  notificationsLastSeenPrefix: `${appStorageKey('notifications:lastSeen')}:`,
  sidebarScroll: appStorageKey('sidebar-scroll'),
  sidebarCollapsed: appStorageKey('sidebar-collapsed'),
} as const;

export const getResumeEventKey = (eventId: string) =>
  `${STORAGE_KEYS.resumeEventPrefix}${eventId}`;

export const getNotificationLastSeenKey = (userId: string) =>
  `${STORAGE_KEYS.notificationsLastSeenPrefix}${userId}`;
