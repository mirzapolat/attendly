import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, MapPin, Loader2, QrCode, AlertTriangle } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';

interface Event {
  id: string;
  name: string;
  event_date: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  location_radius_meters: number;
  current_qr_token: string | null;
  qr_token_expires_at: string | null;
  is_active: boolean;
}

const attendeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email').max(255),
});

type SubmitState = 'form' | 'loading' | 'success' | 'error' | 'expired' | 'already-submitted' | 'inactive';

const Attend = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>('loading');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    initializeFingerprint();
    fetchEvent();
  }, [id]);

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

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      setSubmitState('inactive');
      return;
    }

    setEvent(data);

    // Check if token is valid
    if (!token || data.current_qr_token !== token) {
      // Check if token recently expired (within 5 seconds grace period)
      if (data.qr_token_expires_at) {
        const expiresAt = new Date(data.qr_token_expires_at).getTime();
        const now = Date.now();
        if (now > expiresAt) {
          setSubmitState('expired');
          return;
        }
      } else {
        setSubmitState('expired');
        return;
      }
    }

    // Check if device already submitted
    if (fingerprint) {
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('event_id', id)
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();

      if (existing) {
        setSubmitState('already-submitted');
        return;
      }
    }

    setSubmitState('form');
  };

  useEffect(() => {
    if (fingerprint && event && submitState === 'form') {
      checkExistingSubmission();
    }
  }, [fingerprint, event]);

  const checkExistingSubmission = async () => {
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

  const requestLocation = () => {
    setLocationRequested(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        setLocationDenied(true);
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

    if (!locationRequested) {
      requestLocation();
      toast({
        title: 'Location required',
        description: 'Please allow or deny location access to continue.',
      });
      return;
    }

    setSubmitState('loading');

    // Determine status
    let status: 'verified' | 'suspicious' = 'verified';
    let suspiciousReason: string | null = null;

    if (locationDenied || !location) {
      status = 'suspicious';
      suspiciousReason = 'Location access denied';
    } else if (event) {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        event.location_lat,
        event.location_lng
      );
      if (distance > event.location_radius_meters) {
        status = 'suspicious';
        suspiciousReason = `Location ${Math.round(distance)}m away from event (allowed: ${event.location_radius_meters}m)`;
      }
    }

    try {
      const { error } = await supabase.from('attendance_records').insert({
        event_id: id,
        attendee_name: name.trim(),
        attendee_email: email.trim().toLowerCase(),
        device_fingerprint: fingerprint,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        location_provided: !!location,
        status,
        suspicious_reason: suspiciousReason,
      });

      if (error) {
        if (error.code === '23505') {
          setSubmitState('already-submitted');
        } else {
          throw error;
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
          <CardDescription className="flex items-center justify-center gap-1">
            <MapPin className="w-4 h-4" />
            {event?.location_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            {/* Location status */}
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
