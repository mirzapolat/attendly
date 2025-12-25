import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, MapPin, Save, Shield, QrCode, Fingerprint, MapPinned, X, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface EventSettingsProps {
  event: {
    id: string;
    name: string;
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
  };
  onClose: () => void;
  onUpdate: (updates: Partial<EventSettingsProps['event']>) => void;
}

const EventSettings = ({ event, onClose, onUpdate }: EventSettingsProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Event details
  const [name, setName] = useState(event.name);
  const [eventDate, setEventDate] = useState(
    new Date(event.event_date).toISOString().slice(0, 16)
  );
  const [locationName, setLocationName] = useState(event.location_name);
  const [locationLat, setLocationLat] = useState(event.location_lat);
  const [locationLng, setLocationLng] = useState(event.location_lng);
  const [radiusMeters, setRadiusMeters] = useState(event.location_radius_meters);

  // Security features
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

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          name,
          event_date: new Date(eventDate).toISOString(),
          location_name: locationName,
          location_lat: locationLat,
          location_lng: locationLng,
          location_radius_meters: radiusMeters,
        })
        .eq('id', event.id);

      if (error) throw error;

      onUpdate({
        name,
        event_date: new Date(eventDate).toISOString(),
        location_name: locationName,
        location_lat: locationLat,
        location_lng: locationLng,
        location_radius_meters: radiusMeters,
      });

      toast({
        title: 'Event updated',
        description: 'Event details have been saved.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update event details.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSecurityToggle = async (
    field: 'rotating_qr_enabled' | 'device_fingerprint_enabled' | 'location_check_enabled',
    value: boolean
  ) => {
    // If enabling location check, verify location is set
    if (field === 'location_check_enabled' && value && !hasValidLocation) {
      toast({
        variant: 'destructive',
        title: 'Location required',
        description: 'Please set a valid location before enabling location check.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .update({ [field]: value })
        .eq('id', event.id);

      if (error) throw error;

      onUpdate({ [field.replace(/_enabled$/, '_enabled') as keyof typeof event]: value });

      // Update local state
      if (field === 'rotating_qr_enabled') setRotatingQrEnabled(value);
      if (field === 'device_fingerprint_enabled') setDeviceFingerprintEnabled(value);
      if (field === 'location_check_enabled') setLocationCheckEnabled(value);

      toast({
        title: 'Security updated',
        description: `${field.replace(/_/g, ' ').replace(' enabled', '')} ${value ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update security setting.',
      });
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('static-qr-code');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const a = document.createElement('a');
      a.download = `${event.name.replace(/\s+/g, '-')}-qr-code.jpg`;
      a.href = canvas.toDataURL('image/jpeg', 0.9);
      a.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const staticQrUrl = `${window.location.origin}/attend/${event.id}?token=static`;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8">
      <Card className="w-full max-w-2xl mx-4 bg-gradient-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Event Settings
            </CardTitle>
            <CardDescription>
              Modify event details and security settings
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Event Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Event Details</h3>
            
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

            {/* Location section with toggle at top */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              {/* Location Check Toggle - Now at top */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <MapPinned className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Location Check</p>
                    <p className="text-xs text-muted-foreground">
                      {locationCheckEnabled
                        ? 'Verify attendees are at the venue'
                        : 'Location verification disabled'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={locationCheckEnabled}
                  onCheckedChange={(v) => handleSecurityToggle('location_check_enabled', v)}
                />
              </div>

              {!hasValidLocation && locationCheckEnabled && (
                <p className="text-sm text-warning bg-warning/10 p-2 rounded">
                  ⚠️ Location check is enabled but no valid location is set. Please add location data.
                </p>
              )}

              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location {!locationCheckEnabled && <span className="text-muted-foreground text-xs">(Optional)</span>}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? 'Getting...' : 'Use Current'}
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
                <Label>Allowed Radius: {radiusMeters}m</Label>
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

            <Button onClick={handleSaveDetails} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Details'}
            </Button>
          </div>

          {/* Security Settings (without location check, which is now in location section) */}
          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <h3 className="font-medium">Security Features</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
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
                  onCheckedChange={(v) => handleSecurityToggle('rotating_qr_enabled', v)}
                />
              </div>

              {/* Static QR download when rotating is disabled */}
              {!rotatingQrEnabled && (
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium">Static QR Code</p>
                    <Button variant="outline" size="sm" onClick={downloadQRCode}>
                      <Download className="w-4 h-4" />
                      Download JPG
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <div className="p-4 bg-background rounded-lg">
                      <QRCodeSVG
                        id="static-qr-code"
                        value={staticQrUrl}
                        size={200}
                        level="M"
                        includeMargin
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Device Fingerprinting</p>
                    <p className="text-xs text-muted-foreground">Prevent multiple submissions per device</p>
                  </div>
                </div>
                <Switch
                  checked={deviceFingerprintEnabled}
                  onCheckedChange={(v) => handleSecurityToggle('device_fingerprint_enabled', v)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventSettings;
