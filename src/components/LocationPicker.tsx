import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LocationPickerErrors = {
  locationName?: string;
  locationLat?: string;
  locationLng?: string;
};

type LocationPickerProps = {
  locationName: string;
  locationLat: number | null;
  locationLng: number | null;
  onLocationNameChange: (value: string) => void;
  onLocationLatChange: (value: number) => void;
  onLocationLngChange: (value: number) => void;
  errors?: LocationPickerErrors;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

const DEFAULT_CENTER: [number, number] = [20, 0];
const LazyLocationPickerMap = lazy(() => import('@/components/LocationPickerMap'));

const LocationPicker = ({
  locationName,
  locationLat,
  locationLng,
  onLocationNameChange,
  onLocationLatChange,
  onLocationLngChange,
  errors,
}: LocationPickerProps) => {
  const [query, setQuery] = useState(locationName);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const currentCenter: [number, number] =
    typeof locationLat === 'number' && typeof locationLng === 'number'
      ? [locationLat, locationLng]
      : DEFAULT_CENTER;

  useEffect(() => {
    setQuery(locationName);
  }, [locationName]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as NominatimResult[];
        setSuggestions(data ?? []);
        setListOpen(true);
      } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const handleSelect = (result: NominatimResult) => {
    const lat = Number.parseFloat(result.lat);
    const lng = Number.parseFloat(result.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    onLocationNameChange(result.display_name);
    onLocationLatChange(lat);
    onLocationLngChange(lng);
    setQuery(result.display_name);
    setSuggestions([]);
    setListOpen(false);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { display_name?: string };
      if (data.display_name) {
        onLocationNameChange(data.display_name);
        setQuery(data.display_name);
      }
    } catch (error) {
      // ignore
    }
  };

  const handleMapSelect = (lat: number, lng: number) => {
    onLocationLatChange(lat);
    onLocationLngChange(lng);
    void reverseGeocode(lat, lng);
  };

  const handleUseCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onLocationLatChange(lat);
        onLocationLngChange(lng);
        void reverseGeocode(lat, lng);
        setGettingLocation(false);
      },
      () => {
        setGettingLocation(false);
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          Address
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? 'Getting...' : 'Use Current Location'}
        </Button>
      </div>
      <div className="relative z-20">
        <Input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            onLocationNameChange(value);
            if (!value.trim()) {
              setSuggestions([]);
            }
          }}
          onFocus={() => setListOpen(true)}
          onBlur={() => window.setTimeout(() => setListOpen(false), 150)}
          placeholder="Search for an address"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {listOpen && suggestions.length > 0 && (
          <div className="absolute z-30 mt-2 w-full rounded-lg border border-border bg-background shadow-md">
            <div className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((result) => (
                <button
                  key={`${result.lat}-${result.lon}-${result.display_name}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(result)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {errors?.locationName && (
        <p className="text-sm text-destructive">{errors.locationName}</p>
      )}
      {(errors?.locationLat || errors?.locationLng) && (
        <p className="text-sm text-destructive">Pick a location from the map or search.</p>
      )}
      <div className="relative z-0 overflow-hidden rounded-lg border border-border">
        <Suspense
          fallback={
            <div className="h-56 w-full bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
              Loading map...
            </div>
          }
        >
          <LazyLocationPickerMap
            currentCenter={currentCenter}
            locationLat={locationLat}
            locationLng={locationLng}
            onSelect={handleMapSelect}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default LocationPicker;
