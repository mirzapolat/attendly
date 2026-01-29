export const STORAGE_KEYS = {
  workspaceId: 'attendly:workspace',
  themeColor: 'attendly:theme-color',
  resumeEventPrefix: 'attendly:resume-event:',
  deviceId: 'attendly:device-id',
  eventsView: 'attendly:events-view',
  welcome: 'attendly:welcome',
  notificationsLastSeenPrefix: 'attendly:notifications:lastSeen:',
  sidebarScroll: 'attendly:sidebar-scroll',
  sidebarCollapsed: 'attendly:sidebar-collapsed',
} as const;

export const getResumeEventKey = (eventId: string) =>
  `${STORAGE_KEYS.resumeEventPrefix}${eventId}`;

export const getNotificationLastSeenKey = (userId: string) =>
  `${STORAGE_KEYS.notificationsLastSeenPrefix}${userId}`;
