import { useEffect, useMemo, useState, useRef, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor, useThemeColor } from '@/hooks/useThemeColor';
import { ArrowRight, Check, CheckCircle, XCircle, MapPin, Loader2, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { appStorageKey } from '@/constants/appBrand';
import { parseSupabaseFunctionError } from '@/utils/supabaseFunctions';
import AppLogo from '@/components/AppLogo';

interface Event {
  id: string;
  workspace_id: string;
  name: string;
  event_date: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  location_radius_meters: number;
  is_active: boolean;
  rotating_qr_enabled: boolean;
  location_check_enabled: boolean;
  theme_color?: string | null;
  brand_logo_url?: string | null;
}

const attendeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email').max(255),
});

type SubmitState =
  | 'form'
  | 'loading'
  | 'success-transition'
  | 'success'
  | 'error'
  | 'expired'
  | 'already-submitted'
  | 'inactive'
  | 'time-expired';

const FORM_TIME_LIMIT_MS = 2 * 60 * 1000; // 2 minutes
const SUCCESS_TRANSITION_MS = 1380;
const REMEMBER_COOKIE = appStorageKey('remember-attendee');
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CLIENT_ID_COOKIE = STORAGE_KEYS.clientId;
const CLIENT_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // ~400 days

const getCookieValue = (key: string): string | null => {
  if (typeof document === 'undefined') return null;
  const cookieString = document.cookie;
  if (!cookieString) return null;

  const entries = cookieString.split('; ');
  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = entry.slice(0, separatorIndex);
    if (name === key) {
      return entry.slice(separatorIndex + 1);
    }
  }

  return null;
};

const buildCookieAttributes = () => {
  const secure =
    typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  return `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
};

const clearRememberCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${REMEMBER_COOKIE}=; Max-Age=0; ${buildCookieAttributes()}`;
};

const consumeRememberCookie = (): { name: string; email: string } | null => {
  const raw = getCookieValue(REMEMBER_COOKIE);
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as { name?: string; email?: string };
    if (!parsed?.name || !parsed?.email) return null;
    return { name: parsed.name, email: parsed.email };
  } catch {
    return null;
  }
};

const storeRememberCookie = (payload: { name: string; email: string }) => {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(JSON.stringify(payload));
  document.cookie = `${REMEMBER_COOKIE}=${encoded}; Max-Age=${REMEMBER_MAX_AGE_SECONDS}; ${buildCookieAttributes()}`;
};

const getStoredClientId = (): string | null => {
  const cookieValue = getCookieValue(CLIENT_ID_COOKIE);
  if (cookieValue) return cookieValue;

  try {
    const existing = localStorage.getItem(STORAGE_KEYS.clientId);
    if (existing) return existing;
  } catch {
    // Ignore storage errors.
  }

  try {
    const existing = sessionStorage.getItem(STORAGE_KEYS.clientId);
    if (existing) return existing;
  } catch {
    // Ignore storage errors.
  }

  return null;
};

const persistClientId = (clientId: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = `${CLIENT_ID_COOKIE}=${clientId}; Max-Age=${CLIENT_ID_MAX_AGE_SECONDS}; ${buildCookieAttributes()}`;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.clientId, clientId);
  } catch {
    // Ignore storage errors.
  }

  try {
    sessionStorage.setItem(STORAGE_KEYS.clientId, clientId);
  } catch {
    // Ignore storage errors.
  }
};

const Attend = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const { themeColor } = useThemeColor();

  const [event, setEvent] = useState<Event | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>('loading');
  const [startErrorMessage, setStartErrorMessage] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(FORM_TIME_LIMIT_MS);
  const [eventThemeColor, setEventThemeColor] = useState<string | null>(null);
  const [rememberSaved, setRememberSaved] = useState(false);
  const [showRememberConfetti, setShowRememberConfetti] = useState(false);
  const [prefilledFromRemember, setPrefilledFromRemember] = useState(false);
  const [isRemembered, setIsRemembered] = useState(false);

  const timerRef = useRef<number | null>(null);
  const pendingLocationSubmitRef = useRef(false);
  const rememberConfettiTimerRef = useRef<number | null>(null);
  const successTransitionTimerRef = useRef<number | null>(null);

  const rememberConfettiPieces = useMemo(() => {
    const colors = [
      'hsl(var(--accent))',
      'hsl(var(--accent) / 0.85)',
      'hsl(var(--accent) / 0.7)',
      'hsl(var(--accent) / 0.55)',
      'hsl(var(--accent) / 0.9)',
    ];
    return Array.from({ length: 12 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: 3 + Math.random() * 4,
      color: colors[index % colors.length],
      duration: 1200 + Math.random() * 700,
      delay: Math.random() * 200,
      drift: (Math.random() - 0.5) * 90,
    }));
  }, []);

  useEffect(() => {
    if (
      !sessionExpiresAt ||
      submitState === 'success' ||
      submitState === 'success-transition' ||
      submitState === 'already-submitted'
    ) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const updateRemaining = () => {
      const expiresMs = Date.parse(sessionExpiresAt);
      const remaining = Number.isNaN(expiresMs) ? 0 : expiresMs - Date.now();
      if (remaining <= 0) {
        setTimeRemaining(0);
        setSubmitState('time-expired');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      setTimeRemaining(remaining);
    };

    updateRemaining();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(updateRemaining, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionExpiresAt, submitState]);

  useEffect(() => {
    if (eventThemeColor) {
      applyThemeColor(eventThemeColor);
      return () => applyThemeColor(themeColor);
    }

    applyThemeColor(themeColor);
  }, [eventThemeColor, themeColor]);

  useEffect(() => {
    if (!id) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (successTransitionTimerRef.current) {
      window.clearTimeout(successTransitionTimerRef.current);
      successTransitionTimerRef.current = null;
    }

    setEvent(null);
    setSessionId(null);
    setSessionExpiresAt(null);
    setSubmitState('loading');
    setName('');
    setEmail('');
    setErrors({});
    setStartErrorMessage(null);
    setClientId(null);
    setLocation(null);
    setLocationRequested(false);
    setLocationDenied(false);
    setTimeRemaining(FORM_TIME_LIMIT_MS);
    setEventThemeColor(null);
    setRememberSaved(false);
    setShowRememberConfetti(false);
    setPrefilledFromRemember(false);
    setIsRemembered(false);

    const remembered = consumeRememberCookie();
    if (remembered) {
      setName(remembered.name);
      setEmail(remembered.email);
      setPrefilledFromRemember(true);
      setIsRemembered(true);
    }

    const existingClientId = getStoredClientId();
    if (existingClientId) {
      persistClientId(existingClientId);
    }

    let cancelled = false;
    const initialize = async () => {
      await startAttendanceSession(existingClientId ?? undefined);
    };
    initialize();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    return () => {
      if (rememberConfettiTimerRef.current) {
        window.clearTimeout(rememberConfettiTimerRef.current);
        rememberConfettiTimerRef.current = null;
      }
      if (successTransitionTimerRef.current) {
        window.clearTimeout(successTransitionTimerRef.current);
        successTransitionTimerRef.current = null;
      }
    };
  }, []);

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const triggerSuccessTransition = () => {
    if (successTransitionTimerRef.current) {
      window.clearTimeout(successTransitionTimerRef.current);
      successTransitionTimerRef.current = null;
    }

    if (prefersReducedMotion()) {
      setSubmitState('success');
      return;
    }

    setSubmitState('success-transition');
    successTransitionTimerRef.current = window.setTimeout(() => {
      setSubmitState('success');
      successTransitionTimerRef.current = null;
    }, SUCCESS_TRANSITION_MS);
  };

  const startAttendanceSession = async (existingClientId?: string) => {
    if (!id) return;

    const { data, error } = await supabase.functions.invoke('attendance-start', {
      body: { eventId: id, token, clientId: existingClientId },
    });

    if (error || !data?.authorized || !data?.event) {
      const reason = data?.reason;
      if (reason === 'already_submitted') {
        setSubmitState('already-submitted');
      } else if (reason === 'inactive' || reason === 'not_found') {
        setSubmitState('inactive');
      } else if (reason === 'expired') {
        setSubmitState('expired');
      } else {
        const parsed = error ? await parseSupabaseFunctionError(error) : {};
        const normalizedReason =
          reason ?? parsed.reason ?? (parsed.status === 404 ? 'function_not_found' : null);
        setStartErrorMessage(resolveStartErrorMessage(normalizedReason));
        setSubmitState('error');
      }
      return;
    }

    setEvent(data.event as Event);
    setSessionId(data.sessionId ?? null);
    setSessionExpiresAt(data.sessionExpiresAt ?? null);
    setEventThemeColor((data.event as Event).theme_color ?? 'default');
    setSubmitState('form');
    if (data.clientId) {
      persistClientId(String(data.clientId));
      setClientId(String(data.clientId));
    }
  };

  const requestLocation = () => {
    setLocationRequested(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(coords);
        if (pendingLocationSubmitRef.current) {
          pendingLocationSubmitRef.current = false;
          submitAttendance(coords);
        }
      },
      (error) => {
        setLocationDenied(true);
        pendingLocationSubmitRef.current = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const resolveStartErrorMessage = (reason?: string | null): string => {
    switch (reason) {
      case 'missing_migrations':
        return "Attendance isn't fully configured yet. Ask the organizer to run the latest database migrations.";
      case 'function_not_found':
        return 'Attendance service is not deployed. Ask the organizer to deploy Edge Functions.';
      case 'server_error':
        return 'Unable to start attendance right now. Please try again shortly.';
      case 'invalid_request':
        return 'Invalid attendance link. Please rescan the QR code.';
      default:
        return 'Please rescan the QR code and try again.';
    }
  };

  const submitAttendance = async (locationOverride?: { lat: number; lng: number } | null) => {
    if (submitState === 'loading') {
      return;
    }

    if (!sessionId) {
      setSubmitState('error');
      return;
    }

    if (!clientId) {
      setSubmitState('error');
      return;
    }

    if (timeRemaining <= 0) {
      setSubmitState('time-expired');
      return;
    }

    setSubmitState('loading');

    try {
      const effectiveLocation = locationOverride ?? location;
      const { data, error } = await supabase.functions.invoke('attendance-submit', {
        body: {
          sessionId,
          token: token ?? undefined,
          clientId: clientId ?? undefined,
          attendeeName: name.trim(),
          attendeeEmail: email.trim().toLowerCase(),
          location: event?.location_check_enabled ? effectiveLocation : null,
          locationDenied,
        },
      });

      if (error || !data?.success) {
        const reason = data?.reason;
        if (reason === 'already_submitted' || reason === 'session_used') {
          setSubmitState('already-submitted');
        } else if (reason === 'session_expired' || reason === 'session_invalid') {
          setSubmitState('time-expired');
        } else if (reason === 'inactive') {
          setSubmitState('inactive');
        } else {
          throw error ?? new Error(reason || 'Unknown error');
        }
      } else {
        if (isRemembered) {
          storeRememberCookie({ name: name.trim(), email: email.trim().toLowerCase() });
        }
        triggerSuccessTransition();
      }
    } catch (error: unknown) {
      setSubmitState('error');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      attendeeSchema.parse({ name, email });
      setErrors({});
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    // Only request location if location check is enabled
    if (event?.location_check_enabled && !location && !locationDenied) {
      pendingLocationSubmitRef.current = true;
      if (!locationRequested) {
        requestLocation();
        toast({
          title: 'Location required',
          description: 'Please allow or deny location access to continue.',
        });
      }
      return;
    }

    pendingLocationSubmitRef.current = false;
    await submitAttendance();
  };

  const handleRememberMe = () => {
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      };
      attendeeSchema.parse(payload);
      storeRememberCookie(payload);
      setIsRemembered(true);
      setRememberSaved(true);
      setShowRememberConfetti(true);
      if (rememberConfettiTimerRef.current) {
        window.clearTimeout(rememberConfettiTimerRef.current);
      }
      rememberConfettiTimerRef.current = window.setTimeout(() => {
        setShowRememberConfetti(false);
        rememberConfettiTimerRef.current = null;
      }, 2000);
      toast({
        title: 'Saved for next time',
        description: 'Your details will be prefilled the next time you open an attendance link.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to save',
        description: 'Please enter a valid name and email before saving.',
      });
    }
  };

  const handleForgetMe = () => {
    clearRememberCookie();
    setIsRemembered(false);
    setRememberSaved(false);
    toast({
      title: 'Forgotten',
      description: 'Your details have been removed and won\'t be prefilled next time.',
    });
  };

  const withLoadDelay = (step: number): CSSProperties => ({
    ['--load-delay' as string]: `${step * 80}ms`,
  });

  const renderPageShell = (content: ReactNode) => (
    <div className="relative isolate min-h-screen overflow-hidden bg-gradient-subtle p-6 flex items-center justify-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-16rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-20 bottom-[-6rem] h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>
      {content}
    </div>
  );

  const renderAttendCard = (
    content: ReactNode,
    options?: { className?: string; style?: CSSProperties },
  ) => (
    <div className="relative w-full max-w-md">
      <div className="pointer-events-none absolute -inset-4 -z-10" aria-hidden="true">
        <div className="absolute inset-x-8 -top-2 h-16 rounded-full bg-primary/25 blur-2xl" />
        <div className="absolute -left-4 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-accent/20 blur-2xl" />
        <div className="absolute -bottom-4 right-8 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
      </div>
      <Card
        className={`relative w-full overflow-hidden border border-border/95 ring-1 ring-black/10 dark:ring-white/15 bg-gradient-card backdrop-blur-sm shadow-[0_30px_90px_-50px_hsl(var(--primary)/0.72),0_20px_45px_-28px_rgba(15,23,42,0.52)] ${options?.className ?? ''}`}
        style={options?.style}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/45 to-transparent dark:from-white/10"
          aria-hidden="true"
        />
        {content}
      </Card>
    </div>
  );

  const renderRecordedState = (alreadySubmitted = false) =>
    renderPageShell(
      <>
        {showRememberConfetti && (
          <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
            {rememberConfettiPieces.map((piece) => {
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
        {renderAttendCard(
          <CardContent className="py-12 text-center">
            <div className="attend-success-mark mx-auto mb-4" role="img" aria-label="Attendance confirmed">
              <div className="attend-success-flipper" aria-hidden="true">
                <div className="attend-success-face attend-success-face-front">
                  <div className="attend-success-glow" />
                  <svg viewBox="0 0 120 120" className="attend-success-svg">
                    <circle cx="60" cy="60" r="42" className="attend-success-fill" />
                    <circle cx="60" cy="60" r="42" className="attend-success-ring" />
                    <path d="M39 62.5L54 77L83 48" className="attend-success-tick" />
                  </svg>
                </div>
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">
              {alreadySubmitted ? 'Already Recorded' : 'Attendance Recorded!'}
            </h1>
            <p className="text-muted-foreground">
              {alreadySubmitted
                ? `Your attendance has already been recorded for ${event?.name}.`
                : `Thank you for checking in to ${event?.name}.`}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {isRemembered ? (
                <div className="overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/16 via-accent/8 to-transparent text-sm">
                  <div className="px-4 pt-3 pb-2 text-left">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent/90">
                      Remembered as
                    </p>
                    <p className="mt-1 font-medium text-foreground">{name.trim()}</p>
                    <p className="text-muted-foreground">{email.trim().toLowerCase()}</p>
                  </div>
                  <div className="border-t border-accent/25 bg-accent/10 px-2 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-full justify-center rounded-md text-muted-foreground hover:bg-background/40 hover:text-foreground"
                      onClick={handleForgetMe}
                    >
                      Forget me
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full bg-accent text-accent-foreground border-accent/40 hover:bg-accent/90"
                  onClick={handleRememberMe}
                  disabled={rememberSaved}
                >
                  {rememberSaved && <Check />}
                  {rememberSaved ? 'Saved for next time' : 'Remember me'}
                </Button>
              )}
            </div>
          </CardContent>,
        )}
      </>,
    );

  // Render states
  if (submitState === 'loading' && !event) {
    return renderPageShell(
      <div className="text-center attend-load-in" style={withLoadDelay(0)}>
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading event...</p>
      </div>,
    );
  }

  if (submitState === 'error' && !event) {
    return renderPageShell(
      renderAttendCard(
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground">
            {startErrorMessage ?? 'Please rescan the QR code and try again.'}
          </p>
        </CardContent>,
      ),
    );
  }

  if (submitState === 'inactive') {
    return renderPageShell(
      renderAttendCard(
        <CardContent className="py-12 text-center">
          <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Event Not Active</h1>
          <p className="text-muted-foreground">
            This event is not currently accepting attendance.
          </p>
        </CardContent>,
      ),
    );
  }

  if (submitState === 'expired') {
    return renderPageShell(
      renderAttendCard(
        <CardContent className="py-12 text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">QR Code Expired</h1>
          <p className="text-muted-foreground">
            This QR code has expired. Please scan the current QR code.
          </p>
        </CardContent>,
      ),
    );
  }

  if (submitState === 'time-expired') {
    return renderPageShell(
      renderAttendCard(
        <CardContent className="py-12 text-center">
          <Clock className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Time Expired</h1>
          <p className="text-muted-foreground">
            You had 2 minutes to complete the form. Please scan the QR code again to get a fresh start.
          </p>
        </CardContent>,
      ),
    );
  }

  if (submitState === 'already-submitted') {
    return renderRecordedState(true);
  }

  if (submitState === 'success-transition') {
    return renderPageShell(
      renderAttendCard(
        <CardContent className="relative py-16">
          <div className="attend-transition-stage" role="status" aria-live="polite">
            <span className="sr-only">Attendance recorded. Preparing confirmation.</span>
            <div className="attend-transition-ghost" aria-hidden="true">
              <span className="attend-transition-line attend-transition-line-lg" />
              <span className="attend-transition-line attend-transition-line-sm" />
              <span className="attend-transition-line attend-transition-line-lg" />
              <span className="attend-transition-pill" />
            </div>
            <div
              className={`attend-transition-check ${event?.brand_logo_url ? 'attend-transition-check--with-logo' : ''}`}
              aria-hidden="true"
            >
              <div className="attend-transition-flipper">
                <div className="attend-transition-face attend-transition-face-front">
                  <div className="attend-transition-check-glow" />
                  <svg viewBox="0 0 120 120" className="attend-transition-check-svg">
                    <circle cx="60" cy="60" r="42" className="attend-transition-check-fill" />
                    <circle cx="60" cy="60" r="42" className="attend-transition-check-ring" />
                    <path d="M39 62.5L54 77L83 48" className="attend-transition-check-tick" />
                  </svg>
                </div>
                {event?.brand_logo_url && (
                  <div className="attend-transition-face attend-transition-face-back">
                    <div className="attend-transition-logo-shell">
                      <img
                        src={event.brand_logo_url}
                        alt=""
                        loading="lazy"
                        className="attend-transition-logo"
                      />
                    </div>
                  </div>
                )}
              </div>
              {event?.brand_logo_url && <div className="attend-transition-logo-shadow-overlay" />}
            </div>
          </div>
        </CardContent>,
        { className: 'attend-card-morph' },
      ),
    );
  }

  if (submitState === 'success') {
    return renderRecordedState();
  }

  return renderPageShell(
    renderAttendCard(
      <>
        <CardHeader className="text-center attend-load-in" style={withLoadDelay(1)}>
          {event?.brand_logo_url ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-background mx-auto mb-4 attend-load-in" style={withLoadDelay(2)}>
              <img
                src={event.brand_logo_url}
                alt={`${event.name} workspace logo`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="attend-load-in" style={withLoadDelay(2)}>
              <AppLogo className="mx-auto mb-4 h-12 w-12" />
            </div>
          )}
          <CardTitle className="attend-load-in" style={withLoadDelay(3)}>{event?.name}</CardTitle>
          <CardDescription className="flex flex-col items-center gap-1 attend-load-in" style={withLoadDelay(4)}>
            {event?.event_date && (
              <span className="flex flex-wrap items-center justify-center gap-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(event.event_date), 'PPP')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(event.event_date), 'HH:mm')}
                </span>
              </span>
            )}
            {event?.location_check_enabled && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location_name}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Time remaining indicator */}
          <div className={`mb-4 p-3 rounded-lg flex items-center justify-center gap-2 ${
            timeRemaining <= 30000 ? 'bg-destructive/10 text-destructive' : 'bg-secondary/50 text-muted-foreground'
          } attend-load-in`} style={withLoadDelay(5)}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-medium">
              {formatTimeRemaining(timeRemaining)}
            </span>
            <span className="text-sm">remaining</span>
          </div>
          {prefilledFromRemember && (
            <div
              className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center text-sm text-foreground attend-load-in"
              style={withLoadDelay(6)}
            >
              Your details were prefilled from your last saved check-in. 🎉
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 attend-load-in" style={withLoadDelay(7)}>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2 attend-load-in" style={withLoadDelay(8)}>
              <Label htmlFor="email">Your Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {/* Location status - only show if location check is enabled */}
            {event?.location_check_enabled && (
              <div className="p-3 rounded-lg bg-secondary/50 text-sm attend-load-in" style={withLoadDelay(9)}>
                {!locationRequested ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    Location will be requested on submit
                  </div>
                ) : locationDenied ? (
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    Location denied - you may be flagged for review
                  </div>
                ) : location ? (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-4 h-4" />
                    Location verified
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Getting location...
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-full attend-load-in" 
              size="lg"
              disabled={submitState === 'loading'}
              style={withLoadDelay(10)}
            >
              {submitState === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <span>Confirm Attendance</span>
                  <ArrowRight />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center attend-load-in" style={withLoadDelay(11)}>
              By submitting, you consent to storing your name/email and functional cookies for attendance checks.
              Location may also be processed if enabled for this event.
            </p>
          </form>
        </CardContent>
      </>,
      { className: 'attend-load-in', style: withLoadDelay(0) },
    ),
  );
};

export default Attend;
