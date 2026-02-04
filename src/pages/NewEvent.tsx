import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Save, Shield, QrCode, Fingerprint, MapPinned, Timer, ShieldCheck, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';
import LocationPicker from '@/components/LocationPicker';

interface Season {
  id: string;
  name: string;
}

const MIN_RADIUS_METERS = 1;
const MAX_RADIUS_METERS = 1_000_000;
const ROTATION_MIN_SECONDS = 2;
const ROTATION_MAX_SECONDS = 60;

const radiusToSlider = (radius: number) => {
  const clamped = Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, radius || MIN_RADIUS_METERS));
  return Math.log10(clamped);
};

const sliderToRadius = (value: number) => Math.round(10 ** value);

const formatRadius = (radius: number) => {
  const formatter = new Intl.NumberFormat(undefined, {
    minimumSignificantDigits: 2,
    maximumSignificantDigits: 2,
  });
  if (radius >= 1000) {
    return `${formatter.format(radius / 1000)}km`;
  }
  if (radius < 10) {
    return `${Math.round(radius)}m`;
  }
  return `${formatter.format(radius)}m`;
};

const NewEvent = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [eventDate, setEventDate] = useState(() => {
    // Default to current date/time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [seasonId, setSeasonId] = useState<string>('none');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const appliedDateParamRef = useRef(false);

  // Security features
  const [rotatingQrEnabled, setRotatingQrEnabled] = useState(true);
  const [rotatingQrSeconds, setRotatingQrSeconds] = useState(6);
  const [showRotationSettings, setShowRotationSettings] = useState(false);
  const [deviceFingerprintEnabled, setDeviceFingerprintEnabled] = useState(true);
  const [fingerprintCollisionStrict, setFingerprintCollisionStrict] = useState(true);
  const [locationCheckEnabled, setLocationCheckEnabled] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !workspaceLoading && !currentWorkspace) {
      navigate('/workspaces');
    }
  }, [authLoading, user, workspaceLoading, currentWorkspace, navigate]);

  useEffect(() => {
    if (currentWorkspace) {
      fetchSeasons();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (appliedDateParamRef.current) return;
    const dateParam = searchParams.get('date');
    if (!dateParam) return;

    const toLocalInput = (date: Date) => {
      const local = new Date(date);
      local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
      return local.toISOString().slice(0, 16);
    };

    if (dateParam.includes('T')) {
      const parsed = new Date(dateParam);
      if (!Number.isNaN(parsed.getTime())) {
        setEventDate(toLocalInput(parsed));
        appliedDateParamRef.current = true;
      }
      return;
    }

    const parts = dateParam.split('-').map(Number);
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
      const [year, month, day] = parts;
      const base = new Date();
      base.setFullYear(year, month - 1, day);
      base.setSeconds(0, 0);
      setEventDate(toLocalInput(base));
      appliedDateParamRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!rotatingQrEnabled) {
      setShowRotationSettings(false);
    }
  }, [rotatingQrEnabled]);

  const fetchSeasons = async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('series')
      .select('*')
      .eq('workspace_id', currentWorkspace.id);
    if (data) setSeasons(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build validation schema dynamically based on location check setting
    const baseSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').max(40, 'Name must be 40 characters or fewer'),
      description: z.string().max(500).optional(),
      eventDate: z.string().min(1, 'Date is required'),
    });

    const locationSchema = locationCheckEnabled
      ? z.object({
          locationName: z.string().min(2, 'Location name is required when location check is enabled'),
          locationLat: z.number().min(-90).max(90),
          locationLng: z.number().min(-180).max(180),
          radiusMeters: z.number().min(MIN_RADIUS_METERS).max(MAX_RADIUS_METERS),
        })
      : z.object({
          locationName: z.string().optional(),
          locationLat: z.number().optional(),
          locationLng: z.number().optional(),
          radiusMeters: z.number().optional(),
        });

    const eventSchema = baseSchema.merge(locationSchema);

    try {
      const data = {
        name,
        description: description || undefined,
        eventDate,
        locationName: locationName || undefined,
        locationLat: typeof locationLat === 'number' ? locationLat : undefined,
        locationLng: typeof locationLng === 'number' ? locationLng : undefined,
        radiusMeters,
      };

      eventSchema.parse(data);
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

    setLoading(true);

    try {
      if (!currentWorkspace) {
        throw new Error('Workspace not selected');
      }
      const { data, error } = await supabase.from('events').insert({
        workspace_id: currentWorkspace.id,
        name,
        description: description || null,
        event_date: new Date(eventDate).toISOString(),
        location_name: locationName || 'No location',
        location_lat: locationLat ?? 0,
        location_lng: locationLng ?? 0,
        location_radius_meters: radiusMeters,
        series_id: seasonId !== 'none' ? seasonId : null,
        rotating_qr_enabled: rotatingQrEnabled,
        rotating_qr_interval_seconds: Math.min(
          ROTATION_MAX_SECONDS,
          Math.max(ROTATION_MIN_SECONDS, Math.round(rotatingQrSeconds)),
        ),
        device_fingerprint_enabled: deviceFingerprintEnabled,
        fingerprint_collision_strict: fingerprintCollisionStrict,
        location_check_enabled: locationCheckEnabled,
      }).select('id').single();

      if (error) throw error;
      if (!data?.id) throw new Error('Missing event id');

      toast({
        title: 'Event created',
        description: 'Your event has been created successfully.',
      });
      navigate(`/events/${data.id}`, { state: { justCreated: true } });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <Button asChild variant="glass" size="sm" className="rounded-full px-3">
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <Card className="bg-gradient-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Create New Event
            </CardTitle>
            <CardDescription>
              Set up an event with optional location verification for attendance tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Event Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Weekly Team Meeting"
                  maxLength={40}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                {!showDescription && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDescription(true)}
                    className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
                  >
                    Add description
                  </Button>
                )}
              </div>

              {showDescription && (
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the event..."
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="eventDate">Date & Time</Label>
                <Input
                  id="eventDate"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className={errors.eventDate ? 'border-destructive' : ''}
                />
                {errors.eventDate && <p className="text-sm text-destructive">{errors.eventDate}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="season">Series (Optional)</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a series" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Series</SelectItem>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Security Features */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <Label className="flex items-center gap-2 text-base font-medium">
                  <Shield className="w-4 h-4" />
                  Security Features
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose which security features to enable for this event.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <QrCode className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Rotating QR Codes</p>
                        <p className="text-xs text-muted-foreground">
                          {rotatingQrEnabled
                            ? `QR code changes every ${rotatingQrSeconds}s`
                            : 'Static QR code (can be downloaded)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {rotatingQrEnabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowRotationSettings((prev) => !prev)}
                          title="Adjust rotation interval"
                        >
                          <Timer className="h-4 w-4" />
                        </Button>
                      )}
                      <Switch
                        checked={rotatingQrEnabled}
                        onCheckedChange={setRotatingQrEnabled}
                      />
                    </div>
                  </div>
                  {showRotationSettings && (
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Timer className="h-3.5 w-3.5" />
                          <span>Rotate every</span>
                        </div>
                        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                          {rotatingQrSeconds}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={ROTATION_MIN_SECONDS}
                        max={ROTATION_MAX_SECONDS}
                        step={1}
                        value={rotatingQrSeconds}
                        onChange={(event) => setRotatingQrSeconds(Number(event.target.value))}
                        className="mt-2 w-full accent-primary"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Device Fingerprinting</p>
                        <p className="text-xs text-muted-foreground">
                          {deviceFingerprintEnabled
                            ? fingerprintCollisionStrict
                              ? 'Strict: block matching fingerprints'
                              : 'Allow + mark suspicious on matches'
                            : 'Prevent multiple submissions per device'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {deviceFingerprintEnabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFingerprintCollisionStrict((prev) => !prev)}
                          title={
                            fingerprintCollisionStrict
                              ? 'Strict block: reject matching fingerprints'
                              : 'Allow + mark suspicious on matches'
                          }
                        >
                          {fingerprintCollisionStrict ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Switch
                        checked={deviceFingerprintEnabled}
                        onCheckedChange={setDeviceFingerprintEnabled}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPinned className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Location Check</p>
                        <p className="text-xs text-muted-foreground">
                          {locationCheckEnabled
                            ? 'Location is required and will be verified'
                            : 'Location is optional'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={locationCheckEnabled}
                      onCheckedChange={setLocationCheckEnabled}
                    />
                  </div>

                  {locationCheckEnabled && (
                    <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-4">
                      <LocationPicker
                        locationName={locationName}
                        locationLat={locationLat}
                        locationLng={locationLng}
                        onLocationNameChange={setLocationName}
                        onLocationLatChange={(value) => setLocationLat(value)}
                        onLocationLngChange={(value) => setLocationLng(value)}
                        errors={{
                          locationName: errors.locationName,
                          locationLat: errors.locationLat,
                          locationLng: errors.locationLng,
                        }}
                      />

                      <div className="space-y-2">
                      <Label htmlFor="radius">Allowed Radius: {formatRadius(radiusMeters)}</Label>
                      <Input
                        id="radius"
                        type="range"
                        min="0"
                        max="6"
                        step="0.01"
                        value={radiusToSlider(radiusMeters)}
                        onChange={(e) => setRadiusMeters(sliderToRadius(parseFloat(e.target.value)))}
                        className="w-full"
                      />
                        <p className="text-xs text-muted-foreground">
                          Attendees must be within this distance from the event location.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                <Save className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Event'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NewEvent;
