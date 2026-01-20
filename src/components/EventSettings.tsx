import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, MapPin, Save, Shield, QrCode, Fingerprint, MapPinned, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeExport from '@/components/QRCodeExport';

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
    device_fingerprint_enabled: boolean;
    location_check_enabled: boolean;
    is_active: boolean;
    current_qr_token: string | null;
    brand_logo_url?: string | null;
  };
  onClose: () => void;
  onUpdate: (updates: Partial<EventSettingsProps['event']>) => void;
}

const EventSettings = ({ event, onClose, onUpdate }: EventSettingsProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Event details
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description ?? '');
  const [eventDate, setEventDate] = useState(
    new Date(event.event_date).toISOString().slice(0, 16)
  );
  const [locationName, setLocationName] = useState(event.location_name);
  const [locationLat, setLocationLat] = useState(event.location_lat);
  const [locationLng, setLocationLng] = useState(event.location_lng);
  const [radiusMeters, setRadiusMeters] = useState(event.location_radius_meters);

  // Security features (now local state until save)
  const [rotatingQrEnabled, setRotatingQrEnabled] = useState(event.rotating_qr_enabled);
  const [deviceFingerprintEnabled, setDeviceFingerprintEnabled] = useState(event.device_fingerprint_enabled);
  const [locationCheckEnabled, setLocationCheckEnabled] = useState(event.location_check_enabled);

  const [gettingLocation, setGettingLocation] = useState(false);

  // Check if location is properly set
  const hasValidLocation = locationName && locationName !== 'No location' && 
    locationLat !== 0 && locationLng !== 0;

  const getCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude);
        setLocationLng(position.coords.longitude);
        setGettingLocation(false);
        toast({
          title: 'Location updated',
          description: 'Your current location has been set.',
        });
      },
      () => {
        setGettingLocation(false);
        toast({
          variant: 'destructive',
          title: 'Location error',
          description: 'Could not get your location.',
        });
      }
    );
  };

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
        device_fingerprint_enabled: deviceFingerprintEnabled,
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

  const staticQrUrl = `${window.location.origin}/attend/${event.id}?token=static`;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8">
      <Card className="w-full max-w-2xl mx-4 bg-gradient-card">
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Event Settings
          </CardTitle>
          <CardDescription>
            Modify event details and security settings.
          </CardDescription>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4"
          >
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveAll();
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="eventDate">Date & Time</Label>
              <Input
                id="eventDate"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            {/* Location Section */}
            <div className="border border-border rounded-lg p-4 space-y-4">
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

              {!hasValidLocation && locationCheckEnabled && (
                <p className="text-sm text-warning bg-warning/10 p-2 rounded">
                  ⚠️ Location check is enabled but no valid location is set. Please add location data below.
                </p>
              )}

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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={locationLat}
                    onChange={(e) => setLocationLat(parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={locationLng}
                    onChange={(e) => setLocationLng(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Allowed Radius (meters): {radiusMeters}m</Label>
                <Input
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Location changes apply to future check-ins only.
                </p>
              </div>
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
                          ? 'QR code changes every 3 seconds'
                          : 'Static QR code (can be downloaded)'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={rotatingQrEnabled}
                    onCheckedChange={setRotatingQrEnabled}
                  />
                </div>

                {!rotatingQrEnabled && (
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium">Static QR Code</p>
                      <QRCodeExport
                        url={staticQrUrl}
                        eventName={event.name}
                        eventDate={event.event_date}
                        brandLogoUrl={event.brand_logo_url ?? null}
                        label="Download JPG"
                      />
                    </div>
                    <div className="flex justify-center">
                      <div className="p-4 bg-background rounded-lg">
                        <QRCodeSVG
                          id="static-qr-code"
                          value={staticQrUrl}
                          size={200}
                          level="M"
                          includeMargin
                          imageSettings={
                            event.brand_logo_url
                              ? { src: event.brand_logo_url, height: 40, width: 40, excavate: true }
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

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

            <Button type="submit" disabled={saving} className="w-full" size="lg">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Event'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventSettings;
