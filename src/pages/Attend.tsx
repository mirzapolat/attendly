import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor, useThemeColor } from '@/hooks/useThemeColor';
import { CheckCircle, XCircle, MapPin, Loader2, QrCode, AlertTriangle, Clock } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';

interface Event {
  id: string;
  admin_id: string;
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
}

const attendeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email').max(255),
});

type SubmitState = 'form' | 'loading' | 'success' | 'error' | 'expired' | 'already-submitted' | 'inactive' | 'time-expired';

const FORM_TIME_LIMIT_MS = 2 * 60 * 1000; // 2 minutes

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
  const [fingerprint, setFingerprint] = useState<string>('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(FORM_TIME_LIMIT_MS);
  const [eventThemeColor, setEventThemeColor] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const pendingLocationSubmitRef = useRef(false);

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
    setFingerprint('');
    setLocation(null);
    setLocationRequested(false);
    setLocationDenied(false);
    setTimeRemaining(FORM_TIME_LIMIT_MS);
    setEventThemeColor(null);

    initializeFingerprint();
    startAttendanceSession();
  }, [id, token]);

  const initializeFingerprint = async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    } catch (error) {
      // Generate a fallback fingerprint
      setFingerprint(`fallback-${Date.now()}-${Math.random().toString(36)}`);
    }
  };

  const startAttendanceSession = async () => {
    if (!id) return;

    const { data, error } = await supabase.functions.invoke('attendance-start', {
      body: { eventId: id, token },
    });

    if (error || !data?.authorized || !data?.event) {
      const reason = data?.reason;
      if (reason === 'inactive' || reason === 'not_found') {
        setSubmitState('inactive');
      } else if (reason === 'expired') {
        setSubmitState('expired');
      } else {
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
          deviceFingerprint: event?.device_fingerprint_enabled ? fingerprint : undefined,
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
              Please rescan the QR code and try again.
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
        <Card className="max-w-md w-full bg-gradient-card text-center">
          <CardContent className="py-12">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Attendance Recorded!</h1>
            <p className="text-muted-foreground">
              Thank you for checking in to {event?.name}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-gradient-card">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle>{event?.name}</CardTitle>
          {event?.location_check_enabled && (
            <CardDescription className="flex items-center justify-center gap-1">
              <MapPin className="w-4 h-4" />
              {event?.location_name}
            </CardDescription>
          )}
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
                'Confirm Attendance'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Attend;
