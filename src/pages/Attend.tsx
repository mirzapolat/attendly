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
  current_qr_token: string | null;
  qr_token_expires_at: string | null;
  is_active: boolean;
  rotating_qr_enabled: boolean;
  device_fingerprint_enabled: boolean;
  location_check_enabled: boolean;
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

  // Get storage key for this event + fingerprint + token (each QR scan gets fresh timer)
  const getStorageKey = (fp: string) => `attend_start_${id}_${fp}_${token || 'static'}`;

  // Check and manage form time limit
  const checkTimeLimit = (fp: string): boolean => {
    const storageKey = getStorageKey(fp);
    const storedData = localStorage.getItem(storageKey);
    
    if (storedData) {
      const startTime = parseInt(storedData, 10);
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= FORM_TIME_LIMIT_MS) {
        return false; // Time expired
      }
      
      setTimeRemaining(FORM_TIME_LIMIT_MS - elapsed);
      return true;
    } else {
      // First visit with this token - store start time
      localStorage.setItem(storageKey, Date.now().toString());
      setTimeRemaining(FORM_TIME_LIMIT_MS);
      return true;
    }
  };

  // Start countdown timer
  const startTimer = (fp: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      const storageKey = getStorageKey(fp);
      const storedData = localStorage.getItem(storageKey);
      
      if (storedData) {
        const startTime = parseInt(storedData, 10);
        const elapsed = Date.now() - startTime;
        const remaining = FORM_TIME_LIMIT_MS - elapsed;
        
        if (remaining <= 0) {
          setTimeRemaining(0);
          setSubmitState('time-expired');
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        } else {
          setTimeRemaining(remaining);
        }
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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
    fetchEvent();
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

  // Check time limit once fingerprint is ready
  useEffect(() => {
    if (!fingerprint || !event || submitState === 'loading') return;
    if (submitState !== 'form') return;

    const hasTime = checkTimeLimit(fingerprint);
    if (!hasTime) {
      setSubmitState('time-expired');
    } else {
      startTimer(fingerprint);
    }
  }, [fingerprint, event, submitState]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, admin_id, name, event_date, location_name, location_lat, location_lng, location_radius_meters, current_qr_token, qr_token_expires_at, is_active, rotating_qr_enabled, device_fingerprint_enabled, location_check_enabled')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      setSubmitState('inactive');
      return;
    }

    setEvent(data);
    if (data.admin_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('theme_color')
        .eq('id', data.admin_id)
        .maybeSingle();
      setEventThemeColor(profile?.theme_color ?? 'default');
    }

    // Check if token is valid (only if rotating QR is enabled)
    if (data.rotating_qr_enabled) {
      if (!token || token === 'static') {
        setSubmitState('expired');
        return;
      }
      
      // Parse timestamp from token (format: uuid_timestamp)
      const tokenParts = token.split('_');
      if (tokenParts.length < 2) {
        setSubmitState('expired');
        return;
      }
      
      const tokenTimestamp = parseInt(tokenParts[tokenParts.length - 1], 10);
      const now = Date.now();
      const tokenAge = now - tokenTimestamp;
      
      // Token is valid for 15 seconds (3s display + 12s grace period for moderator polling + scan time)
      if (isNaN(tokenTimestamp) || tokenAge > 15000) {
        setSubmitState('expired');
        return;
      }
    }

    setSubmitState('form');
  };

  // Check fingerprint after it's loaded (separate from fetchEvent to avoid race condition)
  useEffect(() => {
    const checkFingerprint = async () => {
      if (!fingerprint || !event || !event.device_fingerprint_enabled) return;
      if (submitState !== 'form') return;
      
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('event_id', id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();

      if (existing) {
        setSubmitState('already-submitted');
      }
    };
    
    checkFingerprint();
  }, [fingerprint, event, id, submitState]);

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

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
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

    // Re-check time limit before submitting (location prompts can take time).
    if (fingerprint) {
      const hasTime = checkTimeLimit(fingerprint);
      if (!hasTime) {
        setSubmitState('time-expired');
        return;
      }
    }

    setSubmitState('loading');

    // Re-fetch event to get latest location settings (in case admin updated them)
    let currentEvent = event;
    if (event?.location_check_enabled) {
      const { data: freshEvent } = await supabase
        .from('events')
        .select('id, location_lat, location_lng, location_radius_meters, location_check_enabled')
        .eq('id', id)
        .maybeSingle();
      
      if (freshEvent) {
        currentEvent = { ...event, ...freshEvent };
      }
    }

    // Determine status based on location check setting
    let status: 'verified' | 'suspicious' = 'verified';
    let suspiciousReason: string | null = null;
    const effectiveLocation = locationOverride ?? location;

    if (currentEvent?.location_check_enabled) {
      if (locationDenied || !effectiveLocation) {
        status = 'suspicious';
        suspiciousReason = 'Location access denied';
      } else if (currentEvent) {
        const distance = calculateDistance(
          effectiveLocation.lat,
          effectiveLocation.lng,
          currentEvent.location_lat,
          currentEvent.location_lng
        );
        if (distance > currentEvent.location_radius_meters) {
          status = 'suspicious';
          suspiciousReason = `Location ${Math.round(distance)}m away from event (allowed: ${currentEvent.location_radius_meters}m)`;
        }
      }
    }

    try {
      const deviceFingerprintToStore = event?.device_fingerprint_enabled
        ? fingerprint
        : `no-fp-${crypto.randomUUID()}`;

      const { error } = await supabase.from('attendance_records').insert({
        event_id: id,
        attendee_name: name.trim(),
        attendee_email: email.trim().toLowerCase(),
        device_fingerprint: deviceFingerprintToStore,
        location_lat: currentEvent?.location_check_enabled ? (effectiveLocation?.lat || null) : null,
        location_lng: currentEvent?.location_check_enabled ? (effectiveLocation?.lng || null) : null,
        location_provided: currentEvent?.location_check_enabled ? !!effectiveLocation : false,
        status,
        suspicious_reason: suspiciousReason,
      });

      if (error) {
        if (error.code === '23505' && event?.device_fingerprint_enabled) {
          setSubmitState('already-submitted');
        } else {
          throw error;
        }
      } else {
        // Clear the timer storage on successful submission
        if (fingerprint) {
          localStorage.removeItem(getStorageKey(fingerprint));
        }
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

    // Re-check time limit before submitting
    if (fingerprint) {
      const hasTime = checkTimeLimit(fingerprint);
      if (!hasTime) {
        setSubmitState('time-expired');
        return;
      }
    }

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
