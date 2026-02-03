import { useEffect, useMemo, useState, useRef, type CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor, useThemeColor } from '@/hooks/useThemeColor';
import { ArrowRight, Check, CheckCircle, XCircle, MapPin, Loader2, QrCode, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { parseSupabaseFunctionError } from '@/utils/supabaseFunctions';

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
  device_fingerprint_enabled: boolean;
  location_check_enabled: boolean;
  theme_color?: string | null;
  brand_logo_url?: string | null;
}

const attendeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email').max(255),
});

type SubmitState = 'form' | 'loading' | 'success' | 'error' | 'expired' | 'already-submitted' | 'inactive' | 'time-expired';

const FORM_TIME_LIMIT_MS = 2 * 60 * 1000; // 2 minutes
const REMEMBER_COOKIE = 'attendly:remember-attendee';
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

  clearRememberCookie();

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

const generateDeviceId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getStoredDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.deviceId);
    if (existing) return existing;
    const next = generateDeviceId();
    localStorage.setItem(STORAGE_KEYS.deviceId, next);
    return next;
  } catch {
    // Fall back to session storage if local storage is unavailable.
  }

  try {
    const existing = sessionStorage.getItem(STORAGE_KEYS.deviceId);
    if (existing) return existing;
    const next = generateDeviceId();
    sessionStorage.setItem(STORAGE_KEYS.deviceId, next);
    return next;
  } catch {
    // Final fallback to in-memory id.
  }

  return generateDeviceId();
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
  const [fingerprint, setFingerprint] = useState<string>('');
  const [fingerprintRaw, setFingerprintRaw] = useState<string>('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(FORM_TIME_LIMIT_MS);
  const [eventThemeColor, setEventThemeColor] = useState<string | null>(null);
  const [rememberSaved, setRememberSaved] = useState(false);
  const [showRememberConfetti, setShowRememberConfetti] = useState(false);
  const [prefilledFromRemember, setPrefilledFromRemember] = useState(false);

  const timerRef = useRef<number | null>(null);
  const pendingLocationSubmitRef = useRef(false);
  const rememberConfettiTimerRef = useRef<number | null>(null);

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
    if (!sessionExpiresAt || submitState === 'success' || submitState === 'already-submitted') {
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

    setEvent(null);
    setSessionId(null);
    setSessionExpiresAt(null);
    setSubmitState('loading');
    setName('');
    setEmail('');
    setErrors({});
    setStartErrorMessage(null);
    setFingerprint('');
    setFingerprintRaw('');
    setLocation(null);
    setLocationRequested(false);
    setLocationDenied(false);
    setTimeRemaining(FORM_TIME_LIMIT_MS);
    setEventThemeColor(null);
    setRememberSaved(false);
    setShowRememberConfetti(false);
    setPrefilledFromRemember(false);

    const remembered = consumeRememberCookie();
    if (remembered) {
      setName(remembered.name);
      setEmail(remembered.email);
      setPrefilledFromRemember(true);
    }

    let cancelled = false;
    const initialize = async () => {
      const { fingerprint: deviceFingerprint, raw: deviceFingerprintRaw } = await initializeFingerprint();
      if (cancelled) return;
      await startAttendanceSession(deviceFingerprint, deviceFingerprintRaw);
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
    };
  }, []);

  const initializeFingerprint = async (): Promise<{ fingerprint: string; raw: string }> => {
    const deviceId = getStoredDeviceId();

    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const raw = result.visitorId?.trim() ?? '';
      const combined = raw ? `${raw}::${deviceId}` : `local-${deviceId}`;
      setFingerprint(combined);
      setFingerprintRaw(raw);
      return { fingerprint: combined, raw };
    } catch (error) {
      const combined = `local-${deviceId}`;
      setFingerprint(combined);
      setFingerprintRaw('');
      return { fingerprint: combined, raw: '' };
    }
  };

  const startAttendanceSession = async (deviceFingerprint?: string, deviceFingerprintRaw?: string) => {
    if (!id) return;

    const { data, error } = await supabase.functions.invoke('attendance-start', {
      body: { eventId: id, token, deviceFingerprint, deviceFingerprintRaw },
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
          attendeeName: name.trim(),
          attendeeEmail: email.trim().toLowerCase(),
          deviceFingerprint: fingerprint || undefined,
          deviceFingerprintRaw: fingerprintRaw || undefined,
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
        setSubmitState('success');
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

    // If device fingerprinting is enabled, ensure fingerprint is ready
    if (event?.device_fingerprint_enabled && !fingerprint) {
      toast({
        title: 'Loading device verification',
        description: 'Please try again in a second.',
      });
      return;
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

  // Render states
  if (submitState === 'loading' && !event) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    );
  }

  if (submitState === 'error' && !event) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground">
              {startErrorMessage ?? 'Please rescan the QR code and try again.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitState === 'inactive') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Event Not Active</h1>
            <p className="text-muted-foreground">
              This event is not currently accepting attendance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitState === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">QR Code Expired</h1>
            <p className="text-muted-foreground">
              This QR code has expired. Please scan the current QR code.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitState === 'time-expired') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <Clock className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Time Expired</h1>
            <p className="text-muted-foreground">
              You had 2 minutes to complete the form. Please scan the QR code again to get a fresh start.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitState === 'already-submitted') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Already Recorded</h1>
            <p className="text-muted-foreground">
              Your attendance has already been recorded for this event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
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
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Attendance Recorded!</h1>
            <p className="text-muted-foreground">
              Thank you for checking in to {event?.name}.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full bg-accent text-accent-foreground border-accent/40 hover:bg-accent/90"
                onClick={handleRememberMe}
                disabled={rememberSaved}
              >
                {rememberSaved && <Check />}
                {rememberSaved ? 'Saved for next time' : 'Remember me'}
              </Button>
              <Link to="/">
                <Button variant="outline" size="sm" className="w-full">
                  Try Attendly
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-gradient-card">
        <CardHeader className="text-center">
          {event?.brand_logo_url ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-background mx-auto mb-4">
              <img
                src={event.brand_logo_url}
                alt={`${event.name} workspace logo`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-7 h-7 text-primary-foreground" />
            </div>
          )}
          <CardTitle>{event?.name}</CardTitle>
          <CardDescription className="flex flex-col items-center gap-1">
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
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-medium">
              {formatTimeRemaining(timeRemaining)}
            </span>
            <span className="text-sm">remaining</span>
          </div>
          {prefilledFromRemember && (
            <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center text-sm text-foreground">
              On your request, your details were prefilled from your last saved check-in. 🎉
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
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
              <div className="p-3 rounded-lg bg-secondary/50 text-sm">
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
              className="w-full" 
              size="lg"
              disabled={submitState === 'loading'}
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
            <p className="text-xs text-muted-foreground text-center">
              By submitting, you consent to your name and email being stored. If enabled for this event, location and
              device fingerprint data may also be processed.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Attend;
