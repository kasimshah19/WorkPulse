'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';

// Dynamically import Leaflet components to avoid SSR window errors
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

export function MapPicker({
  location = { lat: 18.5204, lng: 73.8567 },
  radiusKm = 5,
  onChangeLocation,
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

  const handleGetCurrentLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onChangeLocation({
            lat: parseFloat(pos.coords.latitude.toFixed(6)),
            lng: parseFloat(pos.coords.longitude.toFixed(6)),
          });
        },
        (err) => {
          alert('GPS location error: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  if (!mounted) {
    return (
      <div className="h-64 w-full rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
        <MapPin className="w-6 h-6 animate-pulse" />
        <span className="ml-2 text-sm">मैप लोड हो रहा है... (Loading Map)</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">
          लोकेशन (Pin): {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </span>
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
        >
          <Navigation className="w-3.5 h-3.5" />
          मेरी लोकेशन (Current Location)
        </button>
      </div>

      <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-700 relative z-10">
        <MapContainer
          center={[location.lat, location.lng]}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {customIcon && (
            <Marker
              position={[location.lat, location.lng]}
              icon={customIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onChangeLocation({
                    lat: parseFloat(position.lat.toFixed(6)),
                    lng: parseFloat(position.lng.toFixed(6)),
                  });
                },
              }}
            />
          )}

          <Circle
            center={[location.lat, location.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.15 }}
          />
        </MapContainer>
      </div>
    </div>
  );
}
