import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Calendar, Save, Shield, QrCode, Fingerprint, MapPinned } from 'lucide-react';
import { z } from 'zod';
import { sanitizeError } from '@/utils/errorHandler';

interface Season {
  id: string;
  name: string;
}

const NewEvent = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(() => {
    // Default to current date/time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [locationName, setLocationName] = useState('Location');
  const [locationLat, setLocationLat] = useState<number | ''>('');
  const [locationLng, setLocationLng] = useState<number | ''>('');
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [seasonId, setSeasonId] = useState<string>('none');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gettingLocation, setGettingLocation] = useState(false);

  // Security features
  const [rotatingQrEnabled, setRotatingQrEnabled] = useState(true);
  const [deviceFingerprintEnabled, setDeviceFingerprintEnabled] = useState(true);
  const [locationCheckEnabled, setLocationCheckEnabled] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSeasons();
    }
  }, [user]);

  const fetchSeasons = async () => {
    const { data } = await supabase.from('seasons').select('*');
    if (data) setSeasons(data);
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude);
        setLocationLng(position.coords.longitude);
        setGettingLocation(false);
        toast({
          title: 'Location set',
          description: 'Your current location has been set as the event location.',
        });
      },
      (error) => {
        setGettingLocation(false);
        toast({
          variant: 'destructive',
          title: 'Location error',
          description: 'Could not get your location. Please enter coordinates manually.',
        });
      }
    );
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
          radiusMeters: z.number().min(50).max(5000),
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
      const { data, error } = await supabase.from('events').insert({
        admin_id: user!.id,
        name,
        description: description || null,
        event_date: new Date(eventDate).toISOString(),
        location_name: locationName || 'No location',
        location_lat: typeof locationLat === 'number' ? locationLat : 0,
        location_lng: typeof locationLng === 'number' ? locationLng : 0,
        location_radius_meters: radiusMeters,
        season_id: seasonId !== 'none' ? seasonId : null,
        rotating_qr_enabled: rotatingQrEnabled,
        device_fingerprint_enabled: deviceFingerprintEnabled,
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
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
              </div>

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
                <Label htmlFor="season">Season (Optional)</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Season</SelectItem>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Section with toggle at top */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                {/* Location Check Toggle - Now at top */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
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

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Event Location {!locationCheckEnabled && <span className="text-muted-foreground text-xs">(Optional)</span>}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? 'Getting...' : 'Use Current Location'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationName">Location Name</Label>
                  <Input
                    id="locationName"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Conference Room A"
                    className={errors.locationName ? 'border-destructive' : ''}
                  />
                  {errors.locationName && <p className="text-sm text-destructive">{errors.locationName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lat">Latitude</Label>
                    <Input
                      id="lat"
                      type="number"
                      step="any"
                      value={locationLat}
                      onChange={(e) => setLocationLat(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="40.7128"
                      className={errors.locationLat ? 'border-destructive' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lng">Longitude</Label>
                    <Input
                      id="lng"
                      type="number"
                      step="any"
                      value={locationLng}
                      onChange={(e) => setLocationLng(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="-74.0060"
                      className={errors.locationLng ? 'border-destructive' : ''}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="radius">Allowed Radius (meters): {radiusMeters}m</Label>
                  <Input
                    id="radius"
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {locationCheckEnabled
                      ? 'Attendees must be within this distance from the event location.'
                      : 'This will be used if location check is enabled later.'}
                  </p>
                </div>
              </div>

              {/* Security Features (without location check, which is now above) */}
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
                        <p className="text-xs text-muted-foreground">QR code changes every 3 seconds</p>
                      </div>
                    </div>
                    <Switch
                      checked={rotatingQrEnabled}
                      onCheckedChange={setRotatingQrEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Device Fingerprinting</p>
                        <p className="text-xs text-muted-foreground">Prevent multiple submissions per device</p>
                      </div>
                    </div>
                    <Switch
                      checked={deviceFingerprintEnabled}
                      onCheckedChange={setDeviceFingerprintEnabled}
                    />
                  </div>
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
