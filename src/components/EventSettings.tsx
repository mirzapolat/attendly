import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Settings, Save, QrCode, MapPinned, Copy, Timer, ShieldCheck, AlertTriangle } from 'lucide-react';
import QRCodeExport from '@/components/QRCodeExport';
import LocationPicker from '@/components/LocationPicker';

interface EventSettingsProps {
  event: {
    id: string;
    name: string;
    description: string | null;
    event_date: string;
    location_name: string;
    location_lat: number;
    location_lng: number;
    location_radius_meters: number;
    rotating_qr_enabled: boolean;
    rotating_qr_interval_seconds?: number | null;
    client_id_check_enabled?: boolean | null;
    client_id_collision_strict?: boolean | null;
    location_check_enabled: boolean;
    is_active: boolean;
    current_qr_token: string | null;
    brand_logo_url?: string | null;
  };
  onClose: () => void;
  onUpdate: (updates: Partial<EventSettingsProps['event']>) => void;
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

const toLocalInputValue = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
};

const EventSettings = ({ event, onClose, onUpdate }: EventSettingsProps) => {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);

  // Event details
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description ?? '');
  const [showDescription, setShowDescription] = useState(Boolean(event.description));
  const [eventDate, setEventDate] = useState(() => toLocalInputValue(event.event_date));
  const [locationName, setLocationName] = useState(event.location_name);
  const [locationLat, setLocationLat] = useState(event.location_lat);
  const [locationLng, setLocationLng] = useState(event.location_lng);
  const [radiusMeters, setRadiusMeters] = useState(event.location_radius_meters);

  // Security features (now local state until save)
  const [rotatingQrEnabled, setRotatingQrEnabled] = useState(event.rotating_qr_enabled);
  const [rotatingQrSeconds, setRotatingQrSeconds] = useState(
    Math.min(
      ROTATION_MAX_SECONDS,
      Math.max(ROTATION_MIN_SECONDS, Number(event.rotating_qr_interval_seconds ?? 3)),
    ),
  );
  const [clientIdCheckEnabled, setClientIdCheckEnabled] = useState(
    event.client_id_check_enabled ?? true,
  );
  const [clientIdCollisionStrict, setClientIdCollisionStrict] = useState(
    event.client_id_collision_strict ?? true,
  );
  const [locationCheckEnabled, setLocationCheckEnabled] = useState(event.location_check_enabled);

  // Check if location is properly set
  const hasValidLocation =
    Boolean(locationName) &&
    locationName !== 'No location' &&
    locationLat !== 0 &&
    locationLng !== 0;

  const handleSaveAll = async () => {
    if (name.length > 40) {
      toast({
        variant: 'destructive',
        title: 'Name too long',
        description: 'Event name must be 40 characters or fewer.',
      });
      return;
    }

    // Validate: if enabling location check, ensure location is set
    if (locationCheckEnabled && !hasValidLocation) {
      toast({
        variant: 'destructive',
        title: 'Location required',
        description: 'Please set a valid location before enabling location check.',
      });
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name,
        description: description || null,
        event_date: new Date(eventDate).toISOString(),
        location_name: locationName,
        location_lat: locationLat,
        location_lng: locationLng,
        location_radius_meters: radiusMeters,
        rotating_qr_enabled: rotatingQrEnabled,
        rotating_qr_interval_seconds: Math.min(
          ROTATION_MAX_SECONDS,
          Math.max(ROTATION_MIN_SECONDS, Math.round(rotatingQrSeconds)),
        ),
        client_id_check_enabled: clientIdCheckEnabled,
        client_id_collision_strict: clientIdCollisionStrict,
        location_check_enabled: locationCheckEnabled,
      };

      const { error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', event.id);

      if (error) throw error;

      onUpdate(updates);

      toast({
        title: 'Settings saved',
        description: 'All event settings have been updated.',
      });
      
      // Close the modal after successful save
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyStaticLink = async () => {
    setCopyingLink(true);
    try {
      await navigator.clipboard.writeText(staticQrUrl);
      toast({
        title: 'Link copied',
        description: 'Static QR link copied to clipboard.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Unable to copy the link. Please try again.',
      });
    } finally {
      setCopyingLink(false);
    }
  };

  const staticQrUrl = `${window.location.origin}/attend/${event.id}?token=static`;
  const exportLogoUrl = event.brand_logo_url ?? currentWorkspace?.brand_logo_url ?? null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="lg:max-w-5xl lg:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Event Settings
          </DialogTitle>
          <DialogDescription>
            Modify event details and security settings.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveAll();
          }}
          className="space-y-6"
        >
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <div className="space-y-6">
              <section className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Basics</p>
                  <h3 className="text-base font-semibold">Event details</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventName">Event Name</Label>
                  <Input
                    id="eventName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Weekly Team Meeting"
                    maxLength={40}
                  />
                  <div className="flex items-center justify-between">
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
                      <span className="text-xs text-muted-foreground">Keep details concise for attendees.</span>
                    )}
                    <span className="text-xs text-muted-foreground">{name.length}/40</span>
                  </div>
                </div>

                {showDescription && (
                  <div className="space-y-2">
                    <Label htmlFor="eventDescription">Description (Optional)</Label>
                    <Textarea
                      id="eventDescription"
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
                  />
                </div>
              </section>

              {locationCheckEnabled && (
                <section className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Location</p>
                    <h3 className="text-base font-semibold">Attendance area</h3>
                  </div>

                  {!hasValidLocation && (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      Location check is enabled but no valid location is set. Please add location data below.
                    </p>
                  )}

                  <LocationPicker
                    locationName={locationName}
                    locationLat={locationLat}
                    locationLng={locationLng}
                    onLocationNameChange={setLocationName}
                    onLocationLatChange={setLocationLat}
                    onLocationLngChange={setLocationLng}
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
                      Location changes apply to future check-ins only.
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Security</p>
                  <h3 className="text-base font-semibold">Protection settings</h3>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <QrCode className="mt-0.5 h-4 w-4 text-muted-foreground" />
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
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
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
                          onChange={(rotationEvent) =>
                            setRotatingQrSeconds(Number(rotationEvent.target.value))
                          }
                          className="w-full accent-primary"
                        />
                      </div>
                    )}

                    {!rotatingQrEnabled && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyStaticLink}
                          disabled={copyingLink}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          {copyingLink ? 'Copying...' : 'Copy link'}
                        </Button>
                        <QRCodeExport
                          url={staticQrUrl}
                          eventName={event.name}
                          eventDate={event.event_date}
                          brandLogoUrl={exportLogoUrl}
                          label="Download JPG"
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
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
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
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
                        <MapPinned className="mt-0.5 h-4 w-4 text-muted-foreground" />
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

          <div className="sticky bottom-0 -mx-5 mt-2 border-t border-border/70 bg-background/80 px-5 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Event'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventSettings;
