import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/utils/errorHandler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LocationPicker from '@/components/LocationPicker';
import { AlertTriangle, Calendar, MapPinned, QrCode, Save, Shield, ShieldCheck, Timer } from 'lucide-react';

interface Season {
  id: string;
  name: string;
}

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
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

const toLocalInputValue = (value: Date) => {
  const local = new Date(value);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
};

const getDefaultDateInput = () => toLocalInputValue(new Date());

const CreateEventDialog = ({ open, onOpenChange, initialDate = null }: CreateEventDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [eventDate, setEventDate] = useState(getDefaultDateInput());
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [seasonId, setSeasonId] = useState<string>('none');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [rotatingQrEnabled, setRotatingQrEnabled] = useState(true);
  const [rotatingQrSeconds, setRotatingQrSeconds] = useState(15);
  const [showRotationSettings, setShowRotationSettings] = useState(false);
  const [clientIdCheckEnabled, setClientIdCheckEnabled] = useState(true);
  const [clientIdCollisionStrict, setClientIdCollisionStrict] = useState(true);
  const [locationCheckEnabled, setLocationCheckEnabled] = useState(false);

  const resetForm = (date: Date | null = null) => {
    setName('');
    setDescription('');
    setShowDescription(false);
    setEventDate(date ? toLocalInputValue(date) : getDefaultDateInput());
    setLocationName('');
    setLocationLat(null);
    setLocationLng(null);
    setRadiusMeters(200);
    setSeasonId('none');
    setErrors({});
    setRotatingQrEnabled(true);
    setRotatingQrSeconds(15);
    setShowRotationSettings(false);
    setClientIdCheckEnabled(true);
    setClientIdCollisionStrict(true);
    setLocationCheckEnabled(false);
  };

  useEffect(() => {
    if (!open) return;
    setEventDate(initialDate ? toLocalInputValue(initialDate) : getDefaultDateInput());
  }, [open, initialDate]);

  useEffect(() => {
    if (!open || !currentWorkspace) return;
    const fetchSeasons = async () => {
      const { data } = await supabase
        .from('series')
        .select('id, name')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (data) setSeasons(data);
    };
    void fetchSeasons();
  }, [open, currentWorkspace]);

  useEffect(() => {
    if (!rotatingQrEnabled) {
      setShowRotationSettings(false);
    }
  }, [rotatingQrEnabled]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      const { data, error } = await supabase
        .from('events')
        .insert({
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
          client_id_check_enabled: clientIdCheckEnabled,
          client_id_collision_strict: clientIdCollisionStrict,
          location_check_enabled: locationCheckEnabled,
        })
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error('Missing event id');

      toast({
        title: 'Event created',
        description: 'Your event has been created successfully.',
      });

      handleDialogOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="lg:max-w-5xl lg:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Create New Event
          </DialogTitle>
          <DialogDescription>
            Set up an event with optional location verification for attendance tracking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Basics</p>
                  <h3 className="text-base font-semibold">Event details</h3>
                </div>

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
                  <div className="flex items-center justify-between">
                    {errors.name ? (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground">Choose a clear name your team recognizes.</span>
                    )}
                    <span className="text-xs text-muted-foreground">{name.length}/40</span>
                  </div>
                </div>

                {!showDescription ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDescription(true)}
                    className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
                  >
                    Add description
                  </Button>
                ) : (
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

                <div className="grid gap-4 md:grid-cols-2">
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
                </div>
              </section>

              {locationCheckEnabled && (
                <section className="rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Location</p>
                    <h3 className="text-base font-semibold">Attendance area</h3>
                  </div>
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
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="radius">Allowed Radius</Label>
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {formatRadius(radiusMeters)}
                      </span>
                    </div>
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
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Security</p>
                  <h3 className="text-base font-semibold">Protection settings</h3>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <QrCode className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Rotating QR Codes</p>
                          <p className="text-xs text-muted-foreground">
                            {rotatingQrEnabled ? `Refresh every ${rotatingQrSeconds}s` : 'Use static QR'}
                          </p>
                        </div>
                      </div>
                      <Switch checked={rotatingQrEnabled} onCheckedChange={setRotatingQrEnabled} />
                    </div>
                    {rotatingQrEnabled && (
                      <div className="mt-3 text-xs text-muted-foreground space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5" />
                            Rotate every
                          </span>
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
                          className="w-full accent-primary"
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Client ID Checks</p>
                          <p className="text-xs text-muted-foreground">
                            {clientIdCheckEnabled ? 'Prevent repeated check-ins' : 'Track only for analytics'}
                          </p>
                        </div>
                      </div>
                      <Switch checked={clientIdCheckEnabled} onCheckedChange={setClientIdCheckEnabled} />
                    </div>
                    {clientIdCheckEnabled && (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Collision Handling</p>
                            <p className="text-xs text-muted-foreground">
                              {clientIdCollisionStrict ? 'Strict block mode' : 'Allow + mark suspicious'}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setClientIdCollisionStrict((prev) => !prev)}
                          title={
                            clientIdCollisionStrict
                              ? 'Strict block: reject matching client IDs'
                              : 'Allow + mark suspicious on matches'
                          }
                        >
                          {clientIdCollisionStrict ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <MapPinned className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Location Check</p>
                          <p className="text-xs text-muted-foreground">
                            {locationCheckEnabled ? 'Require attendees near your location' : 'Location optional'}
                          </p>
                        </div>
                      </div>
                      <Switch checked={locationCheckEnabled} onCheckedChange={setLocationCheckEnabled} />
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>

          <div className="sticky bottom-0 -mx-5 sm:-mx-6 mt-2 border-t border-border/70 bg-background/80 px-5 py-4 backdrop-blur-md sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="w-4 h-4" />
                  {loading ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEventDialog;
