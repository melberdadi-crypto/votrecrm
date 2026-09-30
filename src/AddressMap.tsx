import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useRef } from "react";
import L, { type LeafletEventHandlerFnMap, type Marker as MarkerType } from "leaflet";

const icone = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function Recentrer({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], map.getZoom() < 10 ? 14 : map.getZoom(), { duration: 0.6 }); }, [lat, lng, map]);
  return null;
}

// Capte les clics sur la carte pour déplacer le point de localisation
function CliquerPourLocaliser({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function AddressMap({ lat, lng, onPositionChange }: { lat: number; lng: number; onPositionChange?: (lat: number, lng: number) => void }) {
  const marqueurRef = useRef<MarkerType | null>(null);
  const gestionnaires: LeafletEventHandlerFnMap | undefined = onPositionChange
    ? { dragend: () => { const m = marqueurRef.current; if (m) { const p = m.getLatLng(); onPositionChange(p.lat, p.lng); } } }
    : undefined;

  return (
    <div>
      <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} style={{ height: 220, width: "100%", borderRadius: 10 }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={icone} draggable={Boolean(onPositionChange)} ref={marqueurRef} eventHandlers={gestionnaires} />
        <Recentrer lat={lat} lng={lng} />
        {onPositionChange && <CliquerPourLocaliser onChange={onPositionChange} />}
      </MapContainer>
      {onPositionChange && <p className="settings-note">Clique sur la carte ou fais glisser le repère pour ajuster l'emplacement exact.</p>}
    </div>
  );
}
