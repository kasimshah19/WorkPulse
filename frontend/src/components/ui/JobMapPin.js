'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

export function JobMapPin({
  lat = 18.5204,
  lng = 73.8567,
  geofenceRadiusMeters = 100,
}) {
  const [mounted, setMounted] = useState(false);
  const [customIcon, setCustomIcon] = useState(null);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then((L) => {
      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      setCustomIcon(icon);
    });
  }, []);

  if (!mounted) {
    return (
      <div className="h-44 w-full rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
        <MapPin className="w-5 h-5 animate-pulse" />
        <span className="ml-2 text-xs">मैप लोड हो रहा है...</span>
      </div>
    );
  }

  return (
    <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-700 relative z-10">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {customIcon && (
          <Marker position={[lat, lng]} icon={customIcon} />
        )}

        <Circle
          center={[lat, lng]}
          radius={geofenceRadiusMeters}
          pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.2 }}
        />
      </MapContainer>
    </div>
  );
}
