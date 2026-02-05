import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect, type CSSProperties, type MouseEvent } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { applyThemeColor } from '@/hooks/useThemeColor';
import { supabase } from '@/integrations/supabase/client';
import { getRuntimeEnv } from '@/lib/runtimeEnv';
import { STORAGE_KEYS, getResumeEventKey } from '@/constants/storageKeys';
import { maskEmail, maskName } from '@/utils/privacy';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/hooks/useConfirm';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, QrCode, Users, MapPin, Calendar, Clock, Play, Square, 
  AlertTriangle, CheckCircle, Shield, Trash2, RefreshCw, Eye, EyeOff, UserPlus, Settings, Copy, Users2, Search, UserMinus, List, ListCollapse, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import EventSettings from '@/components/EventSettings';
import ModerationSettings from '@/components/ModerationSettings';
import ExcuseLinkSettings from '@/components/ExcuseLinkSettings';
import AttendeeActions from '@/components/AttendeeActions';
import QRCodeExport from '@/components/QRCodeExport';

interface Event {
  id: string;
  workspace_id?: string | null;
  name: string;
  description: string | null;
  event_date: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  location_radius_meters: number;
  is_active: boolean;
  current_qr_token: string | null;
  qr_token_expires_at: string | null;
  qr_host_device_id: string | null;
  qr_host_lease_expires_at: string | null;
  rotating_qr_enabled: boolean;
  rotating_qr_interval_seconds?: number | null;
  client_id_check_enabled?: boolean | null;
  client_id_collision_strict?: boolean | null;
  location_check_enabled: boolean;
  moderation_enabled: boolean;
  moderator_show_full_name: boolean;
  moderator_show_email: boolean;
}

interface AttendanceRecord {
  id: string;
  attendee_name: string;
  attendee_email: string;
  status: 'verified' | 'suspicious' | 'cleared' | 'excused';
  suspicious_reason: string | null;
  location_provided: boolean;
  location_lat: number | null;
  location_lng: number | null;
  recorded_at: string;
  client_id?: string | null;
  client_id_raw?: string | null;
}

interface KnownAttendee {
  attendee_name: string;
  attendee_email: string;
}

const POLL_INTERVAL_MS = 1100;
const RESUME_WINDOW_MS = 15000;
const ROTATION_GRACE_MS = 7000;
const ROTATION_MIN_SECONDS = 2;
const ROTATION_MAX_SECONDS = 60;
const QR_HOST_LEASE_MS = 20000;
const QR_HOST_HEARTBEAT_MS = 10000;
const ATTENDANCE_LIST_BOTTOM_GAP = 64;
const ATTENDANCE_LIST_MIN_HEIGHT = 240;
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, session, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrToken, setQrToken] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(3);
  const intervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const hostHeartbeatRef = useRef<number | null>(null);
  const hostDeviceIdRef = useRef<string | null>(null);
  const hostClaimInFlightRef = useRef(false);
  const [isQrHost, setIsQrHost] = useState(false);
  
  // Privacy controls
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());
  const [revealedEmails, setRevealedEmails] = useState<Set<string>>(new Set());
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  
  // Manual add attendee
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [suggestions, setSuggestions] = useState<KnownAttendee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsWrapRef = useRef<HTMLDivElement | null>(null);
  const attendanceListRef = useRef<HTMLDivElement | null>(null);
  const [attendanceListMaxHeight, setAttendanceListMaxHeight] = useState<number | null>(null);
  const [copyingStaticLink, setCopyingStaticLink] = useState(false);
  const [clientIdDialogOpen, setClientIdDialogOpen] = useState(false);
  const [clientIdDialogKey, setClientIdDialogKey] = useState<string | null>(null);
  const [clientIdBulkAction, setClientIdBulkAction] = useState<'clearing' | 'deleting' | null>(null);
  
  // Settings modals
  const [showSettings, setShowSettings] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [showExcuseLinks, setShowExcuseLinks] = useState(false);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  type StatusFilter = 'all' | 'verified' | 'suspicious' | 'excused';
  type CloudBurst = { x: number; y: number; id: number; strength: number };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cloudBursts, setCloudBursts] = useState<Record<StatusFilter, CloudBurst | null>>({
    all: null,
    verified: null,
    suspicious: null,
    excused: null,
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [qrEntrance, setQrEntrance] = useState(false);
  const qrEntranceTimerRef = useRef<number | null>(null);
  const prevActiveRef = useRef<boolean | null>(null);
  const [startButtonPulse, setStartButtonPulse] = useState(false);
  const startButtonPulseTimerRef = useRef<number | null>(null);
  const [qrRefreshPulse, setQrRefreshPulse] = useState(false);
  const qrRefreshTimerRef = useRef<number | null>(null);
  const prevQrTokenRef = useRef<string | null>(null);

  const toggleCompactExpand = useCallback((recordId: string) => {
    if (!compactView) return;
    setExpandedRecordId((prev) => (prev === recordId ? null : recordId));
  }, [compactView]);

  useEffect(() => {
    if (!compactView) {
      setExpandedRecordId(null);
    }
  }, [compactView]);

  const updateAttendanceListMaxHeight = useCallback(() => {
    if (!attendanceListRef.current) return;
    if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      setAttendanceListMaxHeight(null);
      return;
    }
    const { top } = attendanceListRef.current.getBoundingClientRect();
    const nextMaxHeight = Math.max(ATTENDANCE_LIST_MIN_HEIGHT, window.innerHeight - top - ATTENDANCE_LIST_BOTTOM_GAP);
    setAttendanceListMaxHeight(nextMaxHeight);
  }, []);

  useLayoutEffect(() => {
    updateAttendanceListMaxHeight();
  }, [updateAttendanceListMaxHeight, showAddForm, attendance.length]);

  useEffect(() => {
    const handleResize = () => updateAttendanceListMaxHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateAttendanceListMaxHeight]);

  useEffect(() => {
    if (!showSuggestions) return;
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      if (!suggestionsWrapRef.current) return;
      if (!suggestionsWrapRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSuggestions]);

  const getClientIdKey = (record: AttendanceRecord) =>
    (record.client_id_raw ?? record.client_id ?? '').trim();

  const triggerStartButtonPulse = () => {
    setStartButtonPulse(true);
    if (startButtonPulseTimerRef.current) {
      window.clearTimeout(startButtonPulseTimerRef.current);
    }
    startButtonPulseTimerRef.current = window.setTimeout(() => {
      setStartButtonPulse(false);
      startButtonPulseTimerRef.current = null;
    }, 260);
  };

  const triggerCloudBurst = (event: MouseEvent<HTMLElement>, filter: StatusFilter) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = rect.width ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect.height ? ((event.clientY - rect.top) / rect.height) * 100 : 50;
    const clampedX = Math.min(100, Math.max(0, x));
    const clampedY = Math.min(100, Math.max(0, y));
    const normalizedX = (clampedX - 50) / 50;
    const normalizedY = (clampedY - 50) / 50;
    const distance = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);
    const strength = Math.min(1, distance / Math.SQRT2);

    setCloudBursts((prev) => {
      const current = prev[filter];
      return {
        ...prev,
        [filter]: {
          x: clampedX,
          y: clampedY,
          strength,
          id: (current?.id ?? 0) + 1,
        },
      };
    });
  };

  const handleStatusFilter = (next: StatusFilter, event?: MouseEvent<HTMLElement>) => {
    if (event) {
      triggerCloudBurst(event, next);
    }
    setStatusFilter((prev) => (prev === next && next !== 'all' ? 'all' : next));
  };

  const getCloudOriginStyle = (filter: StatusFilter): CSSProperties | undefined => {
    const burst = cloudBursts[filter];
    if (!burst) return undefined;
    return {
      ['--cloudy-origin-x' as string]: `${burst.x}%`,
      ['--cloudy-origin-y' as string]: `${burst.y}%`,
      ['--cloudy-strength' as string]: `${burst.strength}`,
    };
  };

  const openClientIdMatches = (record: AttendanceRecord) => {
    const key = getClientIdKey(record);
    if (!key) return;
    setClientIdDialogKey(key);
    setClientIdDialogOpen(true);
  };

  const clearClientIdMatches = async () => {
    if (!clientIdMatches.length) return;
    const ids = clientIdMatches.filter((record) => record.status === 'suspicious').map((record) => record.id);
    if (!ids.length) return;

    setClientIdBulkAction('clearing');
    const { error } = await supabase
      .from('attendance_records')
      .update({ status: 'cleared', suspicious_reason: null })
      .in('id', ids);

    setClientIdBulkAction(null);

    if (!error) {
      fetchAttendance();
    }
  };

  const deleteClientIdMatches = async () => {
    if (!clientIdMatches.length) return;
    const confirmed = await confirm({
      title: 'Delete matching attendees?',
      description: `Delete all ${clientIdMatches.length} records that share this client ID? This cannot be undone.`,
      confirmText: 'Delete all',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setClientIdBulkAction('deleting');
    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .in('id', clientIdMatches.map((record) => record.id));

    setClientIdBulkAction(null);

    if (!error) {
      fetchAttendance();
      setClientIdDialogOpen(false);
      setClientIdDialogKey(null);
    }
  };

  const confettiPieces = useMemo(() => {
    const colors = ['#66d7b3', '#66d7b3', '#14b8a6', '#f59e0b', '#66d7b3'];
    return Array.from({ length: 18 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: 4 + Math.random() * 6,
      color: colors[index % colors.length],
      duration: 1800 + Math.random() * 1400,
      delay: Math.random() * 500,
      drift: (Math.random() - 0.5) * 140,
    }));
  }, []);

  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  const brandLogoUrl = currentWorkspace?.brand_logo_url ?? null;
  const qrLogoSettings = brandLogoUrl
    ? { src: brandLogoUrl, height: 56, width: 56, excavate: true }
    : undefined;
  const rotationSeconds = Math.min(
    ROTATION_MAX_SECONDS,
    Math.max(ROTATION_MIN_SECONDS, Number(event?.rotating_qr_interval_seconds ?? 3)),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hostDeviceIdRef.current) return;
    try {
      const existing = sessionStorage.getItem(STORAGE_KEYS.qrHostTabId);
      if (existing) {
        hostDeviceIdRef.current = existing;
        return;
      }
      const next =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(STORAGE_KEYS.qrHostTabId, next);
      hostDeviceIdRef.current = next;
    } catch {
      hostDeviceIdRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    if (!event) return;
    const wasActive = prevActiveRef.current;
    if (event.is_active && wasActive === false) {
      setQrEntrance(true);
      if (qrEntranceTimerRef.current) {
        window.clearTimeout(qrEntranceTimerRef.current);
      }
      qrEntranceTimerRef.current = window.setTimeout(() => {
        setQrEntrance(false);
        qrEntranceTimerRef.current = null;
      }, 900);
    }
    prevActiveRef.current = event.is_active;
    return () => {
      if (qrEntranceTimerRef.current) {
        window.clearTimeout(qrEntranceTimerRef.current);
        qrEntranceTimerRef.current = null;
      }
    };
  }, [event]);

  const isLeaseExpired = useCallback((leaseExpiresAt?: string | null) => {
    if (!leaseExpiresAt) return true;
    const expiresMs = Date.parse(leaseExpiresAt);
    if (Number.isNaN(expiresMs)) return true;
    return Date.now() >= expiresMs;
  }, []);

  const hostTabId = hostDeviceIdRef.current;
  const isActiveHost = Boolean(
    event?.is_active &&
      event?.rotating_qr_enabled &&
      isQrHost &&
      hostTabId &&
      event?.qr_host_device_id === hostTabId &&
      !isLeaseExpired(event?.qr_host_lease_expires_at),
  );
  const shouldWarnOnLeave = Boolean(isActiveHost);

  const claimQrHost = useCallback(async () => {
    if (!id) return false;
    const deviceId = hostDeviceIdRef.current;
    if (!deviceId) return false;
    if (hostClaimInFlightRef.current) return false;
    hostClaimInFlightRef.current = true;
    try {
      const leaseExpiresAt = new Date(Date.now() + QR_HOST_LEASE_MS).toISOString();
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .update({
          qr_host_device_id: deviceId,
          qr_host_lease_expires_at: leaseExpiresAt,
        })
        .eq('id', id)
        .or(`qr_host_device_id.is.null,qr_host_lease_expires_at.lt.${nowIso},qr_host_device_id.eq.${deviceId}`)
        .select('qr_host_device_id, qr_host_lease_expires_at')
        .maybeSingle();

      if (error || !data) {
        setIsQrHost(false);
        return false;
      }

      const isHost = data.qr_host_device_id === deviceId;
      setIsQrHost(isHost);
      if (isHost) {
        setEvent((prev) =>
          prev
            ? {
                ...prev,
                qr_host_device_id: data.qr_host_device_id,
                qr_host_lease_expires_at: data.qr_host_lease_expires_at,
              }
            : prev,
        );
      }
      return isHost;
    } finally {
      hostClaimInFlightRef.current = false;
    }
  }, [id]);

  const refreshQrHostLease = useCallback(async () => {
    if (!id) return false;
    const deviceId = hostDeviceIdRef.current;
    if (!deviceId) return false;
    const leaseExpiresAt = new Date(Date.now() + QR_HOST_LEASE_MS).toISOString();
    const { data, error } = await supabase
      .from('events')
      .update({ qr_host_lease_expires_at: leaseExpiresAt })
      .eq('id', id)
      .eq('qr_host_device_id', deviceId)
      .select('qr_host_device_id, qr_host_lease_expires_at')
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    const stillHost = data.qr_host_device_id === deviceId;
    if (stillHost) {
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              qr_host_device_id: data.qr_host_device_id,
              qr_host_lease_expires_at: data.qr_host_lease_expires_at,
            }
          : prev,
      );
    }
    return stillHost;
  }, [id]);

  useEffect(() => {
    if (!event?.is_active || !event?.rotating_qr_enabled) {
      setIsQrHost(false);
      return;
    }
    const deviceId = hostDeviceIdRef.current;
    if (!deviceId) return;
    const isSelfHost =
      event.qr_host_device_id === deviceId && !isLeaseExpired(event.qr_host_lease_expires_at);
    if (isSelfHost) {
      setIsQrHost(true);
      return;
    }
    if (!event.qr_host_device_id || isLeaseExpired(event.qr_host_lease_expires_at)) {
      void claimQrHost();
      return;
    }
    setIsQrHost(false);
  }, [
    event?.is_active,
    event?.rotating_qr_enabled,
    event?.qr_host_device_id,
    event?.qr_host_lease_expires_at,
    claimQrHost,
    isLeaseExpired,
  ]);

  useEffect(() => {
    if (!isQrHost || !event?.is_active || !event?.rotating_qr_enabled) {
      if (hostHeartbeatRef.current) {
        window.clearInterval(hostHeartbeatRef.current);
        hostHeartbeatRef.current = null;
      }
      return;
    }

    const heartbeat = async () => {
      const stillHost = await refreshQrHostLease();
      if (!stillHost) {
        setIsQrHost(false);
      }
    };

    void heartbeat();
    hostHeartbeatRef.current = window.setInterval(() => {
      void heartbeat();
    }, QR_HOST_HEARTBEAT_MS);

    return () => {
      if (hostHeartbeatRef.current) {
        window.clearInterval(hostHeartbeatRef.current);
        hostHeartbeatRef.current = null;
      }
    };
  }, [event?.is_active, event?.rotating_qr_enabled, isQrHost, refreshQrHostLease]);

  useEffect(() => {
    if (!event?.is_active || !event?.rotating_qr_enabled) {
      prevQrTokenRef.current = qrToken || null;
      return;
    }
    if (!qrToken) {
      prevQrTokenRef.current = null;
      return;
    }
    if (prevQrTokenRef.current && prevQrTokenRef.current !== qrToken) {
      setQrRefreshPulse(true);
      if (qrRefreshTimerRef.current) {
        window.clearTimeout(qrRefreshTimerRef.current);
      }
      qrRefreshTimerRef.current = window.setTimeout(() => {
        setQrRefreshPulse(false);
        qrRefreshTimerRef.current = null;
      }, 500);
    }
    prevQrTokenRef.current = qrToken;
  }, [qrToken, event?.is_active, event?.rotating_qr_enabled]);

  useEffect(() => {
    return () => {
      if (startButtonPulseTimerRef.current) {
        window.clearTimeout(startButtonPulseTimerRef.current);
        startButtonPulseTimerRef.current = null;
      }
      if (qrRefreshTimerRef.current) {
        window.clearTimeout(qrRefreshTimerRef.current);
        qrRefreshTimerRef.current = null;
      }
    };
  }, []);

  const syncAccentColor = useCallback(
    async (workspaceId?: string | null) => {
      if (!workspaceId) {
        applyThemeColor('default');
        return;
      }
      if (currentWorkspace?.id === workspaceId && currentWorkspace.brand_color) {
        applyThemeColor(currentWorkspace.brand_color);
        return;
      }
      const { data, error } = await supabase
        .from('workspaces')
        .select('brand_color')
        .eq('id', workspaceId)
        .maybeSingle();
      if (error) {
        return;
      }
      const nextColor = data?.brand_color ?? 'default';
      applyThemeColor(nextColor);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.themeColor, nextColor);
        localStorage.setItem(`${STORAGE_KEYS.themeColor}:${workspaceId}`, nextColor);
      }
    },
    [currentWorkspace?.brand_color, currentWorkspace?.id]
  );

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      setLoading(false);
      return;
    }

    if (data) {
      setEvent(data);
      void syncAccentColor(data.workspace_id);
    }
    setLoading(false);
  }, [id, syncAccentColor]);

  const fetchAttendance = useCallback(async (_opts?: { silent?: boolean }) => {
    if (!id) return;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('event_id', id)
      .order('recorded_at', { ascending: false });

    if (error) {
      return;
    }

    if (data) setAttendance(data as AttendanceRecord[]);
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!justCreated || !id) return;
    setShowConfetti(true);
    const timer = window.setTimeout(() => setShowConfetti(false), 2800);
    navigate(`/events/${id}`, { replace: true });
    return () => window.clearTimeout(timer);
  }, [justCreated, id, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    fetchEvent();
    fetchAttendance();
    const eventIntervalId = window.setInterval(() => {
      void fetchEvent();
    }, POLL_INTERVAL_MS);
    const intervalId = window.setInterval(() => {
      void fetchAttendance({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(eventIntervalId);
      window.clearInterval(intervalId);
    };
  }, [user, id, fetchEvent, fetchAttendance]);

  useEffect(() => {
    if (!shouldWarnOnLeave) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'Leaving will stop the event and pause rotating QR codes.';
    };

    const handlePageHide = () => {
      if (!id || !session?.access_token || !hostTabId) {
        return;
      }

      try {
        sessionStorage.setItem(getResumeEventKey(id), String(Date.now()));
      } catch {
        // Ignore storage failures; resume is best-effort.
      }

      const runtimeEnv = getRuntimeEnv();
      const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey =
        runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return;
      }

      const payload = JSON.stringify({
        is_active: false,
        current_qr_token: null,
        qr_token_expires_at: null,
        qr_host_device_id: null,
        qr_host_lease_expires_at: null,
      });

      void fetch(`${supabaseUrl}/rest/v1/events?id=eq.${id}&qr_host_device_id=eq.${hostTabId}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: payload,
        keepalive: true,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [shouldWarnOnLeave, id, session?.access_token, hostTabId]);

  const stopEventForExit = async () => {
    if (!event?.is_active || !id) {
      return true;
    }

    if (!hostTabId) {
      return true;
    }

    const { error } = await supabase
      .from('events')
      .update({
        is_active: false,
        current_qr_token: null,
        qr_token_expires_at: null,
        qr_host_device_id: null,
        qr_host_lease_expires_at: null,
      })
      .eq('id', id)
      .eq('qr_host_device_id', hostTabId);

    if (error) {
      return false;
    }

    setEvent((prev) =>
      prev
        ? {
            ...prev,
            is_active: false,
            qr_host_device_id: null,
            qr_host_lease_expires_at: null,
          }
        : null,
    );
    setIsQrHost(false);
    return true;
  };

  const handleDashboardClick = async (clickEvent: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldWarnOnLeave) {
      return;
    }

    clickEvent.preventDefault();
    const confirmed = await confirm({
      title: 'Leave event page?',
      description: 'Leaving will stop the event and pause rotating QR codes.',
      confirmText: 'Leave page',
      variant: 'destructive',
    });
    if (!confirmed) return;
    const stopped = await stopEventForExit();
    if (stopped) {
      navigate('/dashboard');
    }
  };

  const toggleRevealName = (recordId: string) => {
    setRevealedNames((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const toggleRevealEmail = (recordId: string) => {
    setRevealedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const generateToken = useCallback(() => {
    // Embed timestamp in token for validation: uuid_timestamp
    const timestamp = Date.now();
    return `${crypto.randomUUID()}_${timestamp}`;
  }, []);

  // Fetch known attendees from same series for autocomplete
  const fetchSuggestions = async (searchTerm: string) => {
    if (!event || searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }

    // First get the event's series_id
    const { data: eventData } = await supabase
      .from('events')
      .select('series_id')
      .eq('id', id)
      .maybeSingle();

    if (!eventData?.series_id) {
      setSuggestions([]);
      return;
    }

    // Get all events in the same series
    const { data: seasonEvents } = await supabase
      .from('events')
      .select('id')
      .eq('series_id', eventData.series_id);

    if (!seasonEvents?.length) {
      setSuggestions([]);
      return;
    }

    const eventIds = seasonEvents.map(e => e.id);

    // Get unique attendees from those events matching the search
    const { data: attendees } = await supabase
      .from('attendance_records')
      .select('attendee_name, attendee_email')
      .in('event_id', eventIds)
      .or(`attendee_name.ilike.%${searchTerm}%,attendee_email.ilike.%${searchTerm}%`);

    if (attendees) {
      // Dedupe by email
      const unique = Array.from(
        new Map(attendees.map(a => [a.attendee_email, a])).values()
      );
      setSuggestions(unique);
    }
  };

  const addManualAttendee = async (status: 'verified' | 'excused') => {
    if (!manualName.trim() || !manualEmail.trim()) {
      return;
    }

    const { error } = await supabase
      .from('attendance_records')
      .insert({
        event_id: id,
        attendee_name: manualName.trim(),
        attendee_email: manualEmail.trim().toLowerCase(),
        client_id: `manual-${crypto.randomUUID()}`,
        status,
        location_provided: false,
      });

    if (!error) {
      setManualName('');
      setManualEmail('');
      setShowAddForm(false);
      setSuggestions([]);
      await fetchAttendance({ silent: true });
    }
  };

  const selectSuggestion = (suggestion: KnownAttendee) => {
    setManualName(suggestion.attendee_name);
    setManualEmail(suggestion.attendee_email);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateQRCode = useCallback(async () => {
    if (!event?.is_active || !event?.rotating_qr_enabled || !isQrHost) return;
    const deviceId = hostDeviceIdRef.current;
    if (!deviceId) return;

    const newToken = generateToken();
    const expiresAt = new Date(Date.now() + rotationSeconds * 1000 + ROTATION_GRACE_MS).toISOString();

    await supabase
      .from('events')
      .update({
        current_qr_token: newToken,
        qr_token_expires_at: expiresAt,
      })
      .eq('id', id)
      .eq('qr_host_device_id', deviceId);

    setQrToken(newToken);
    setTimeLeft(rotationSeconds);
  }, [id, event?.is_active, event?.rotating_qr_enabled, generateToken, rotationSeconds, isQrHost]);

  useEffect(() => {
    if (event?.is_active && event?.rotating_qr_enabled && isQrHost) {
      updateQRCode();
      intervalRef.current = window.setInterval(() => {
        updateQRCode();
      }, rotationSeconds * 1000);

      const countdownInterval = window.setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : rotationSeconds));
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        clearInterval(countdownInterval);
      };
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [event?.is_active, event?.rotating_qr_enabled, updateQRCode, rotationSeconds, isQrHost]);

  useEffect(() => {
    if (!event) return;
    if (event.is_active && !event.rotating_qr_enabled) {
      setQrToken('static');
      return;
    }
    if (!event.is_active) {
      setQrToken('');
      return;
    }
    if (!isQrHost && event.rotating_qr_enabled) {
      setQrToken(event.current_qr_token ?? '');
      setTimeLeft(rotationSeconds);
    }
  }, [
    event?.current_qr_token,
    event?.is_active,
    event?.rotating_qr_enabled,
    isQrHost,
    rotationSeconds,
  ]);

  useEffect(() => {
    if (isQrHost) {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }
    if (event?.is_active && event?.rotating_qr_enabled) {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : rotationSeconds));
      }, 1000);
      return () => {
        if (countdownIntervalRef.current) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [event?.is_active, event?.rotating_qr_enabled, event?.current_qr_token, isQrHost, rotationSeconds]);

  useEffect(() => {
    if (!event || !id) return;
    const resumeKey = getResumeEventKey(id);

    if (event.is_active) {
      try {
        sessionStorage.removeItem(resumeKey);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    if (!event.rotating_qr_enabled) {
      try {
        sessionStorage.removeItem(resumeKey);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    let resumeAt: number | null = null;
    try {
      const raw = sessionStorage.getItem(resumeKey);
      if (!raw) return;
      resumeAt = Number(raw);
    } catch {
      return;
    }

    let isReload = false;
    try {
      const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      isReload = entry?.type === 'reload';
    } catch {
      isReload = false;
    }

    if (!isReload) {
      try {
        const legacyNavigation = (performance as Performance & { navigation?: { type?: number } })
          .navigation;
        isReload = legacyNavigation?.type === 1;
      } catch {
        isReload = false;
      }
    }

    if (!isReload) {
      try {
        sessionStorage.removeItem(resumeKey);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    if (!resumeAt || Number.isNaN(resumeAt)) {
      try {
        sessionStorage.removeItem(resumeKey);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    if (Date.now() - resumeAt > RESUME_WINDOW_MS) {
      try {
        sessionStorage.removeItem(resumeKey);
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    try {
      sessionStorage.removeItem(resumeKey);
    } catch {
      // Ignore storage failures.
    }

    const resumeEvent = async () => {
      const newToken = generateToken();
      const expiresAt = new Date(Date.now() + rotationSeconds * 1000 + ROTATION_GRACE_MS).toISOString();
      const deviceId = hostDeviceIdRef.current;
      const leaseExpiresAt = deviceId
        ? new Date(Date.now() + QR_HOST_LEASE_MS).toISOString()
        : null;
      const { error } = await supabase
        .from('events')
        .update({
          is_active: true,
          current_qr_token: newToken,
          qr_token_expires_at: expiresAt,
          qr_host_device_id: deviceId ?? null,
          qr_host_lease_expires_at: leaseExpiresAt,
        })
        .eq('id', id);

      if (error) {
        return;
      }

      setEvent((prev) =>
        prev
          ? {
              ...prev,
              is_active: true,
              current_qr_token: newToken,
              qr_token_expires_at: expiresAt,
              qr_host_device_id: deviceId ?? null,
              qr_host_lease_expires_at: leaseExpiresAt,
            }
          : prev
      );
      setQrToken(newToken);
      setTimeLeft(rotationSeconds);
      setIsQrHost(Boolean(deviceId));
    };

    void resumeEvent();
  }, [event, id, generateToken, rotationSeconds]);

  const handleEventUpdate = (updates: Partial<Event>) => {
    setEvent((prev) => prev ? { ...prev, ...updates } : null);
  };

  const toggleActive = async () => {
    const newStatus = !event?.is_active;
    if (newStatus) {
      triggerStartButtonPulse();
    }
    const deviceId = hostDeviceIdRef.current;
    const expiresAt = newStatus
      ? new Date(Date.now() + rotationSeconds * 1000 + ROTATION_GRACE_MS).toISOString()
      : null;
    const leaseExpiresAt =
      newStatus && deviceId ? new Date(Date.now() + QR_HOST_LEASE_MS).toISOString() : null;
    
    const { error } = await supabase
      .from('events')
      .update({ 
        is_active: newStatus,
        current_qr_token: newStatus ? generateToken() : null,
        qr_token_expires_at: expiresAt,
        qr_host_device_id: newStatus ? deviceId ?? null : null,
        qr_host_lease_expires_at: newStatus ? leaseExpiresAt : null,
      })
      .eq('id', id);

    if (!error) {
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              is_active: newStatus,
              qr_host_device_id: newStatus ? deviceId ?? null : null,
              qr_host_lease_expires_at: newStatus ? leaseExpiresAt : null,
            }
          : null,
      );
      setIsQrHost(Boolean(newStatus && deviceId));
    }
  };

  const updateStatus = async (
    recordId: string,
    newStatus: 'verified' | 'suspicious' | 'cleared' | 'excused'
  ) => {
    const { error } = await supabase
      .from('attendance_records')
      .update({
        status: newStatus,
        suspicious_reason: newStatus === 'suspicious' ? undefined : null,
      })
      .eq('id', recordId);

    if (!error) {
      fetchAttendance();
    }
  };

  const deleteRecord = async (recordId: string) => {
    const record = attendance.find(r => r.id === recordId);
    const attendeeName = record ? (showAllDetails || revealedNames.has(recordId) ? record.attendee_name : maskName(record.attendee_name)) : 'this attendee';
    
    const confirmed = await confirm({
      title: 'Delete attendee?',
      description: `Are you sure you want to delete ${attendeeName} from the attendance list? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    const { error } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', recordId);

    if (!error) {
      fetchAttendance();
    }
  };

  const qrUrl = `${window.location.origin}/attend/${id}?token=${qrToken}`;
  const staticQrUrl = `${window.location.origin}/attend/${id}?token=static`;

  const handleCopyStaticLink = async () => {
    setCopyingStaticLink(true);
    try {
      await navigator.clipboard.writeText(staticQrUrl);
    } catch (error) {
      void error;
    } finally {
      setCopyingStaticLink(false);
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
    } catch (error) {
      void error;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Event not found</p>
          <Link to="/dashboard" onClick={handleDashboardClick}>
            <Button>Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const verifiedCount = attendance.filter(a => a.status === 'verified' || a.status === 'cleared').length;
  const suspiciousCount = attendance.filter(a => a.status === 'suspicious').length;
  const excusedCount = attendance.filter(a => a.status === 'excused').length;
  const attendedCount = attendance.length - excusedCount;
  const totalCloudStyle = (() => {
    const baseStyle = getCloudOriginStyle('all') ?? {};
    if (statusFilter === 'all' && !cloudBursts.all) {
      return {
        ...baseStyle,
        ['--cloudy-opacity' as string]: '0.06',
        ['--cloudy-opacity-secondary' as string]: '0.03',
      } as CSSProperties;
    }
    return baseStyle as CSSProperties;
  })();
  const clientIdMatches = clientIdDialogKey
    ? attendance.filter((record) => {
        const clientId = (record.client_id_raw ?? record.client_id ?? '').trim();
        return clientId && clientId === clientIdDialogKey;
      })
    : [];

  return (
    <div className="min-h-screen bg-gradient-subtle overflow-x-hidden">
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
          {confettiPieces.map((piece) => {
            const confettiStyle = {
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              backgroundColor: piece.color,
              animationDuration: `${piece.duration}ms`,
              animationDelay: `${piece.delay}ms`,
              ['--confetti-drift' as string]: `${piece.drift}px`,
            } as CSSProperties;
            return <span key={piece.id} className="confetti-piece" style={confettiStyle} />;
          })}
        </div>
      )}
      {showSettings && event && (
        <EventSettings
          event={{ ...event, brand_logo_url: brandLogoUrl }}
          onClose={() => setShowSettings(false)}
          onUpdate={handleEventUpdate}
        />
      )}
      {showModeration && event && (
        <ModerationSettings
          eventId={event.id}
          eventName={event.name}
          moderationEnabled={event.moderation_enabled}
          moderatorShowFullName={event.moderator_show_full_name}
          moderatorShowEmail={event.moderator_show_email}
          onClose={() => setShowModeration(false)}
          onUpdate={(settings) => setEvent((prev) => prev ? { ...prev, ...settings } : null)}
        />
      )}
      {showExcuseLinks && event && (
        <ExcuseLinkSettings
          eventId={event.id}
          eventName={event.name}
          onClose={() => setShowExcuseLinks(false)}
        />
      )}
      <Dialog
        open={clientIdDialogOpen}
        onOpenChange={(open) => {
          setClientIdDialogOpen(open);
          if (!open) setClientIdDialogKey(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Matching client IDs</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {clientIdMatches.length === 0
                ? 'No matching records found.'
                : `Found ${clientIdMatches.length} record${clientIdMatches.length === 1 ? '' : 's'} with the same client ID.`}
            </p>
            {clientIdMatches.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/60 bg-background/60">
                {clientIdMatches.map((match) => (
                  <div key={match.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{match.attendee_name}</p>
                      <p className="text-xs text-muted-foreground">{match.attendee_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-muted-foreground">
                        <span className="block">{match.status}</span>
                        <span className="block">{format(new Date(match.recorded_at), 'p')}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRecord(match.id)}
                        title="Delete record"
                        className="icon-trigger"
                      >
                        <Trash2 className="w-4 h-4 text-destructive icon-shake" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearClientIdMatches}
                disabled={
                  clientIdBulkAction !== null ||
                  clientIdMatches.every((record) => record.status !== 'suspicious')
                }
                className="gap-2 icon-trigger"
              >
                {clientIdBulkAction === 'clearing' ? (
                  'Verifying...'
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 icon-pop" />
                    Verify and close
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={deleteClientIdMatches}
                disabled={clientIdBulkAction !== null || clientIdMatches.length === 0}
              >
                {clientIdBulkAction === 'deleting' ? 'Deleting...' : 'Delete all'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <header className="container mx-auto px-4 sm:px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <Button
            asChild
            variant="glass"
            size="sm"
            className="rounded-full px-3 icon-trigger"
          >
            <Link to="/dashboard" onClick={handleDashboardClick}>
              <ArrowLeft className="w-4 h-4 icon-slide-left" />
              <span className="hidden md:inline">Events</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModeration(true)}
              title="Moderation settings"
              className="gap-2 icon-trigger"
            >
              <Users2 className="w-4 h-4 icon-bounce" />
              <span className="hidden md:inline">Moderation</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExcuseLinks(true)}
              title="Excuse links"
              className="gap-2 icon-trigger"
            >
              <UserMinus className="w-4 h-4 icon-drop" />
              <span className="hidden md:inline">Excuses</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              title="Event settings"
              className="gap-2 gear-trigger icon-trigger"
            >
              <Settings className="w-4 h-4 gear-icon" />
              <span className="hidden md:inline">Settings</span>
            </Button>
            <Button
              variant={event.is_active ? 'destructive' : 'hero'}
              onClick={toggleActive}
              className={`gap-2 rounded-full ${startButtonPulse ? 'animate-button-press' : ''} ${event.is_active ? 'stop-event-trigger' : 'start-event-trigger'}`}
            >
              {event.is_active ? (
                <>
                  <Square className="w-4 h-4 stop-event-icon" />
                  <span className="hidden md:inline">Stop Event</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 start-event-icon" />
                  <span className="hidden md:inline">Start Event</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto mt-1 px-4 sm:px-6 pt-4 sm:pt-8 pb-8 overflow-x-hidden">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* QR Code Section */}
          <div className="min-w-0">
            <Card className="bg-gradient-card">
              <CardHeader>
                <CardTitle className="min-w-0">
                  <span className="min-w-0 truncate">{event.name}</span>
                </CardTitle>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1 break-words">{event.description}</p>
                )}
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(event.event_date), 'PPP')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(event.event_date), 'HH:mm')}
                  </span>
                  {event.location_check_enabled && (
                    <span className="flex items-center gap-1 min-w-0 break-words">
                      <MapPin className="w-4 h-4" />
                      {event.location_name}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {event.is_active ? (
                  <div className={`text-center ${qrEntrance ? 'animate-qr-entrance' : ''}`}>
                    <div
                      className={`inline-block w-full max-w-[240px] sm:max-w-[280px] p-3 sm:p-4 bg-background rounded-2xl overflow-hidden shadow-lg mb-4 ${
                        qrRefreshPulse ? 'animate-qr-refresh' : ''
                      }`}
                    >
                      <QRCodeSVG
                        value={qrUrl}
                        size={280}
                        level="M"
                        includeMargin
                        imageSettings={qrLogoSettings}
                        className="w-full h-auto qr-rounded"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      {event.rotating_qr_enabled ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Refreshing in {timeLeft}s
                        </>
                      ) : (
                        <span>Static QR Code</span>
                      )}
                    </div>
                    {event.rotating_qr_enabled && (
                      <div className="mt-2 flex items-center justify-center">
                        <Badge variant={isActiveHost ? 'default' : 'secondary'} className="text-[10px] uppercase tracking-wide">
                          {isActiveHost ? 'Host' : 'Viewer'}
                        </Badge>
                      </div>
                    )}
                    {!event.rotating_qr_enabled && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyStaticLink}
                          disabled={copyingStaticLink}
                          className="gap-2 icon-trigger"
                        >
                          <Copy className="h-4 w-4 icon-copy" />
                          {copyingStaticLink ? 'Copying...' : 'Copy link'}
                        </Button>
                        <QRCodeExport
                          url={qrUrl}
                          eventName={event.name}
                          eventDate={event.event_date}
                          brandLogoUrl={brandLogoUrl}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Start the event to display the QR code
                    </p>
                    <Button
                      onClick={toggleActive}
                      variant="hero"
                      className={`gap-2 rounded-full start-event-trigger ${startButtonPulse ? 'animate-button-press' : ''}`}
                    >
                      <Play className="w-4 h-4 start-event-icon" />
                      Start Event
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats - clickable filters */}
            <div className="grid grid-cols-2 min-[560px]:grid-cols-4 gap-4 mt-4">
              <Card 
                className={`bg-gradient-card relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--primary)/0.45)] filter-cloudy-primary ${statusFilter === 'all' ? 'ring-2 ring-primary filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--primary)/0.45)]' : ''}`}
                onClick={(event) => handleStatusFilter('all', event)}
                style={totalCloudStyle}
              >
                {cloudBursts.all && (
                  <span key={cloudBursts.all.id} className="filter-cloud-burst" />
                )}
                <CardContent className="py-4 text-center relative z-10">
                  <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{attendance.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card 
                className={`bg-gradient-card relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--warning)/0.45)] filter-cloudy-warning ${statusFilter === 'excused' ? 'ring-2 ring-warning filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--warning)/0.45)]' : ''}`}
                onClick={(event) => handleStatusFilter('excused', event)}
                style={getCloudOriginStyle('excused')}
              >
                {cloudBursts.excused && (
                  <span key={cloudBursts.excused.id} className="filter-cloud-burst" />
                )}
                <CardContent className="py-4 text-center relative z-10">
                  <UserMinus className="w-5 h-5 mx-auto mb-1 text-warning" />
                  <p className="text-2xl font-bold">{excusedCount}</p>
                  <p className="text-xs text-muted-foreground">Excused</p>
                </CardContent>
              </Card>
              <Card 
                className={`bg-gradient-card relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--success)/0.45)] filter-cloudy-success ${statusFilter === 'verified' ? 'ring-2 ring-success filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--success)/0.45)]' : ''}`}
                onClick={(event) => handleStatusFilter('verified', event)}
                style={getCloudOriginStyle('verified')}
              >
                {cloudBursts.verified && (
                  <span key={cloudBursts.verified.id} className="filter-cloud-burst" />
                )}
                <CardContent className="py-4 text-center relative z-10">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-success" />
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </CardContent>
              </Card>
              <Card 
                className={`bg-gradient-card relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--destructive)/0.45)] filter-cloudy-destructive ${statusFilter === 'suspicious' ? 'ring-2 ring-destructive filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--destructive)/0.45)]' : ''}`}
                onClick={(event) => handleStatusFilter('suspicious', event)}
                style={getCloudOriginStyle('suspicious')}
              >
                {cloudBursts.suspicious && (
                  <span key={cloudBursts.suspicious.id} className="filter-cloud-burst" />
                )}
                <CardContent className="py-4 text-center relative z-10">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-destructive" />
                  <p className="text-2xl font-bold">{suspiciousCount}</p>
                  <p className="text-xs text-muted-foreground">Suspicious</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Attendance List */}
          <div className="min-w-0">
            <div className="sm:hidden mb-4">
              <Card className="bg-gradient-card">
                <CardContent className="py-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Attendance
                    </h2>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        Attended {attendedCount}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        Excused {excusedCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className={`gap-2 flex-1 icon-trigger ${showAddForm ? 'border-2 border-accent hover:border-accent' : ''}`}
                      >
                        <UserPlus className="w-4 h-4 icon-pop" />
                        Add
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllDetails(!showAllDetails)}
                        className="gap-2 flex-1 icon-trigger"
                      >
                        {showAllDetails ? <EyeOff className="w-4 h-4 icon-blink" /> : <Eye className="w-4 h-4 icon-blink" />}
                        {showAllDetails ? 'Hide' : 'Details'}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AttendeeActions
                        eventId={id!}
                        eventName={event.name}
                        attendance={attendance}
                        onImportComplete={fetchAttendance}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCompactView((prev) => !prev)}
                        aria-pressed={compactView}
                        title={compactView ? 'Switch to normal view' : 'Switch to compact view'}
                        className="icon-trigger"
                      >
                        {compactView ? <List className="w-4 h-4 icon-list" /> : <ListCollapse className="w-4 h-4 icon-list" />}
                        <span className="sr-only">{compactView ? 'Normal view' : 'Compact view'}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="hidden sm:flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Attendance
                <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  Attended {attendedCount}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  Excused {excusedCount}
                </span>
              </h2>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className={`gap-2 icon-trigger ${showAddForm ? 'border-2 border-accent hover:border-accent' : ''}`}
                >
                  <UserPlus className="w-4 h-4 icon-pop" />
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllDetails(!showAllDetails)}
                  className="gap-2 icon-trigger"
                >
                  {showAllDetails ? <EyeOff className="w-4 h-4 icon-blink" /> : <Eye className="w-4 h-4 icon-blink" />}
                  {showAllDetails ? 'Hide' : 'Details'}
                </Button>
                <AttendeeActions
                  eventId={id!}
                  eventName={event.name}
                  attendance={attendance}
                  onImportComplete={fetchAttendance}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCompactView((prev) => !prev)}
                  className="gap-2 icon-trigger"
                  aria-pressed={compactView}
                  title={compactView ? 'Switch to normal view' : 'Switch to compact view'}
                >
                  {compactView ? <List className="w-4 h-4 icon-list" /> : <ListCollapse className="w-4 h-4 icon-list" />}
                  <span className="sr-only">{compactView ? 'Normal view' : 'Compact view'}</span>
                </Button>
              </div>
            </div>

            {/* Search bar */}
            <div className="hidden sm:block relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Manual Add Form */}
            {showAddForm && (
              <Card className="bg-gradient-card mb-4">
                <CardContent className="py-4">
                  <div className="space-y-3">
                    <div ref={suggestionsWrapRef} className="space-y-3">
                      <div className="relative">
                        <Input
                          placeholder="Name"
                          value={manualName}
                          onChange={(e) => {
                            setManualName(e.target.value);
                            setShowSuggestions(true);
                            fetchSuggestions(e.target.value);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
                              <span>Suggestions</span>
                              <button
                                type="button"
                                className="font-semibold text-accent hover:text-accent/80"
                                onClick={() => setShowSuggestions(false)}
                              >
                                Hide
                              </button>
                            </div>
                            {suggestions.map((s, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                                onClick={() => selectSuggestion(s)}
                              >
                                <p className="font-medium text-sm">{s.attendee_name}</p>
                                <p className="text-xs text-muted-foreground">{s.attendee_email}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Input
                        placeholder="Email"
                        type="email"
                        value={manualEmail}
                        onChange={(e) => {
                          setManualEmail(e.target.value);
                          setShowSuggestions(true);
                          fetchSuggestions(e.target.value);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => addManualAttendee('verified')} className="flex-1 gap-2 icon-trigger">
                        <CheckCircle className="w-4 h-4 icon-pop" />
                        Attended
                      </Button>
                      <Button size="sm" variant="warning" onClick={() => addManualAttendee('excused')} className="flex-1 gap-2 icon-trigger">
                        <UserMinus className="w-4 h-4 icon-drop" />
                        Excused
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowAddForm(false);
                        setManualName('');
                        setManualEmail('');
                        setSuggestions([]);
                        setShowSuggestions(false);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {(() => {
              const filteredAttendance = attendance.filter((record) => {
                const matchesSearch = searchQuery === '' || 
                  record.attendee_name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === 'all' ||
                  (statusFilter === 'verified' && (record.status === 'verified' || record.status === 'cleared')) ||
                  (statusFilter === 'suspicious' && record.status === 'suspicious') ||
                  (statusFilter === 'excused' && record.status === 'excused');
                return matchesSearch && matchesStatus;
              });

              if (attendance.length === 0) {
                return (
                  <Card className="bg-gradient-card">
                    <CardContent className="py-12 text-center">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No attendance records yet</p>
                    </CardContent>
                  </Card>
                );
              }

              if (filteredAttendance.length === 0) {
                return (
                  <Card className="bg-gradient-card">
                    <CardContent className="py-12 text-center">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No matching attendees found</p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="relative">
                  <div
                    ref={attendanceListRef}
                    style={attendanceListMaxHeight ? { maxHeight: attendanceListMaxHeight } : undefined}
                    className={`lg:max-h-[600px] overflow-y-auto ${compactView ? 'space-y-1' : 'space-y-2'}`}
                  >
                    {filteredAttendance.map((record) => {
                      const isExpanded = compactView && expandedRecordId === record.id;
                      return (
                    <Card
                      key={record.id}
                      className={`bg-gradient-card ${record.status === 'suspicious' ? 'border-warning/50' : ''}`}
                    >
                      <CardContent
                        className={`${compactView && !isExpanded ? 'py-2 cursor-pointer' : 'py-3'}${compactView ? ' cursor-pointer' : ''}`}
                        onClick={() => {
                          if (compactView) {
                            toggleCompactExpand(record.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className={`flex items-center gap-2 ${compactView && !isExpanded ? 'mb-0.5' : 'mb-1'}`}>
                            <p 
                              className={`font-medium truncate ${!showAllDetails && !revealedNames.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                              onClick={() => !showAllDetails && toggleRevealName(record.id)}
                              title={!showAllDetails && !revealedNames.has(record.id) ? 'Click to reveal' : undefined}
                            >
                              {showAllDetails || revealedNames.has(record.id) 
                                ? record.attendee_name 
                                : maskName(record.attendee_name)}
                            </p>
                            <Badge
                              variant={
                                record.status === 'verified'
                                  ? 'default'
                                  : record.status === 'suspicious'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className={
                                record.status === 'excused'
                                  ? 'bg-warning/10 text-warning border-warning/20'
                                  : undefined
                              }
                            >
                              {record.status}
                            </Badge>
                          </div>
                          {(!compactView || isExpanded) && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <p 
                                  className={`text-sm text-muted-foreground truncate flex-1 flex items-center gap-1.5 ${!showAllDetails && !revealedEmails.has(record.id) ? 'cursor-pointer hover:text-primary' : ''}`}
                                  onClick={() => !showAllDetails && toggleRevealEmail(record.id)}
                                  title={!showAllDetails && !revealedEmails.has(record.id) ? 'Click to reveal' : undefined}
                                >
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  {showAllDetails || revealedEmails.has(record.id) 
                                    ? record.attendee_email 
                                    : maskEmail(record.attendee_email)}
                                </p>
                                {(showAllDetails || revealedEmails.has(record.id)) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 flex-shrink-0 icon-trigger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyEmail(record.attendee_email);
                                    }}
                                    title="Copy email"
                                  >
                                    <Copy className="w-3 h-3 icon-copy" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(record.recorded_at), 'p')}
                                </span>
                                {event?.location_check_enabled && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {record.location_provided ? 'Location verified' : 'No location'}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                          {record.suspicious_reason && (
                            <div className={`flex items-center gap-2 ${compactView && !isExpanded ? 'mt-0.5' : 'mt-1'}`}>
                              <p className="text-xs text-warning flex items-center gap-1 break-words">
                                <AlertTriangle className="w-3 h-3" />
                                {record.suspicious_reason}
                              </p>
                              {record.suspicious_reason.toLowerCase().includes('client id') &&
                                getClientIdKey(record) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openClientIdMatches(record);
                                    }}
                                    title="Show matching client ID entries"
                                  >
                                    Show matches
                                  </Button>
                                )}
                              {event?.location_check_enabled &&
                                record.location_lat != null &&
                                record.location_lng != null && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-xs gap-1 icon-trigger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://www.google.com/maps?q=${record.location_lat},${record.location_lng}`, '_blank');
                                  }}
                                  title="Show on Google Maps"
                                >
                                  <MapPin className="w-3 h-3 icon-pin" />
                                  Show on map
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-1"
                          onClick={(event) => {
                            if (compactView) {
                              event.stopPropagation();
                            }
                          }}
                        >
                          {record.status === 'excused' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'verified')}
                              title="Mark as attending"
                              className="icon-trigger"
                            >
                              <CheckCircle className="w-4 h-4 text-success icon-pop" />
                            </Button>
                          )}
                          {(record.status === 'verified' || record.status === 'cleared') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'excused')}
                              title="Mark as excused"
                              className="icon-trigger"
                            >
                              <UserMinus className="w-4 h-4 text-warning icon-drop" />
                            </Button>
                          )}
                          {record.status === 'suspicious' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'cleared')}
                              title="Clear flag"
                              className="icon-trigger"
                            >
                              <Shield className="w-4 h-4 text-success icon-tilt" />
                            </Button>
                          )}
                          {record.status === 'cleared' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(record.id, 'suspicious')}
                              title="Flag as suspicious"
                              className="icon-trigger"
                            >
                              <AlertTriangle className="w-4 h-4 text-warning icon-warn" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRecord(record.id)}
                            title="Delete record"
                            className="icon-trigger"
                          >
                            <Trash2 className="w-4 h-4 text-destructive icon-shake" />
                          </Button>
                        </div>
                        </div>
                      </CardContent>
                    </Card>
                      );
                    })}
                    <div className="hidden sm:block h-10" aria-hidden="true" />
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 hidden h-10 bg-gradient-to-t from-[hsl(var(--page-bg-end))] via-[hsl(var(--page-bg-end)/0.7)] to-transparent sm:block" />
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventDetail;
