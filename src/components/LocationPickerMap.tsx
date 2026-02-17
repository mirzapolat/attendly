import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

type LocationPickerMapProps = {
  currentCenter: [number, number];
  locationLat: number | null;
  locationLng: number | null;
  onSelect: (lat: number, lng: number) => void;
};

delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: false });
  }, [center, map]);
  return null;
};

const MapClickHandler = ({ onSelect }: { onSelect: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (event) => {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

const LocationPickerMap = ({ currentCenter, locationLat, locationLng, onSelect }: LocationPickerMapProps) => (
  <MapContainer
    center={currentCenter}
    zoom={typeof locationLat === 'number' && typeof locationLng === 'number' ? 13 : 2}
    className="h-56 w-full"
    scrollWheelZoom
  >
    <TileLayer
      attribution="&copy; OpenStreetMap contributors"
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <MapUpdater center={currentCenter} />
    <MapClickHandler onSelect={onSelect} />
    {typeof locationLat === 'number' && typeof locationLng === 'number' && (
      <Marker position={[locationLat, locationLng]} />
    )}
  </MapContainer>
);

export default LocationPickerMap;
