'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, AlertTriangle, Crosshair } from 'lucide-react';

/**
 * Computes destination point given start point, distance in meters and bearing in degrees.
 */
export function computeOffsetPoint(lat, lng, distanceMeters, bearingDegrees) {
  const R = 6371000; // Earth radius in meters
  const δ = distanceMeters / R;
  const θ = (bearingDegrees * Math.PI) / 180;

  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * Math.sin(φ2);
  const λ2 = λ1 + Math.atan2(y, x);

  return {
    lat: Number(((φ2 * 180) / Math.PI).toFixed(6)),
    lng: Number(((((λ2 * 180) / Math.PI + 540) % 360) - 180).toFixed(6)),
  };
}

export function LocationSimulator({
  siteLat = 18.5204,
  siteLng = 73.8567,
  onLocationChange,
  active,
  onToggleActive,
}) {
  const isDev = process.env.NEXT_PUBLIC_DEV_MODE === 'true' || process.env.NODE_ENV !== 'production';

  const [simLat, setSimLat] = useState(siteLat);
  const [simLng, setSimLng] = useState(siteLng);
  const [activePreset, setActivePreset] = useState('inside');

  useEffect(() => {
    // Default inside 50m north
    const pt = computeOffsetPoint(siteLat, siteLng, 50, 0);
    setSimLat(pt.lat);
    setSimLng(pt.lng);
  }, [siteLat, siteLng]);

  const applyPreset = (label, dist, bearing) => {
    const pt = computeOffsetPoint(siteLat, siteLng, dist, bearing);
    setSimLat(pt.lat);
    setSimLng(pt.lng);
    setActivePreset(label);
    if (active && onLocationChange) {
      onLocationChange({ lat: pt.lat, lng: pt.lng, accuracy: 10 });
    }
  };

  const handleManualChange = (lat, lng) => {
    setSimLat(lat);
    setSimLng(lng);
    setActivePreset('custom');
    if (active && onLocationChange) {
      onLocationChange({ lat, lng, accuracy: 10 });
    }
  };

  if (!isDev) return null;

  return (
    <div className="mb-4 rounded-xl border-2 border-yellow-400 bg-yellow-50 p-3 text-slate-800 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-yellow-200">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="font-bold text-sm tracking-wide text-yellow-900">
            DEV: GPS Location Simulator
          </span>
        </div>
        <label className="flex items-center cursor-pointer space-x-2">
          <span className="text-xs font-semibold text-yellow-900">
            {active ? 'Simulator ON' : 'Simulator OFF'}
          </span>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              const checked = e.target.checked;
              onToggleActive(checked);
              if (checked && onLocationChange) {
                onLocationChange({ lat: simLat, lng: simLng, accuracy: 10 });
              }
            }}
            className="h-4 w-4 rounded text-yellow-600 focus:ring-yellow-500"
          />
        </label>
      </div>

      {active && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => applyPreset('inside', 50, 0)}
              className={`rounded-lg py-1.5 px-2 text-xs font-bold transition ${
                activePreset === 'inside'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-white border border-green-500 text-green-800 hover:bg-green-50'
              }`}
            >
              Inside (50m N)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('edge', 95, 90)}
              className={`rounded-lg py-1.5 px-2 text-xs font-bold transition ${
                activePreset === 'edge'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-white border border-emerald-500 text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Edge (95m E)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('outside', 130, 180)}
              className={`rounded-lg py-1.5 px-2 text-xs font-bold transition ${
                activePreset === 'outside'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-white border border-amber-500 text-amber-800 hover:bg-amber-50'
              }`}
            >
              Outside (130m S)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('far', 300, 270)}
              className={`rounded-lg py-1.5 px-2 text-xs font-bold transition ${
                activePreset === 'far'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-white border border-red-500 text-red-800 hover:bg-red-50'
              }`}
            >
              Far (300m W)
            </button>
          </div>

          <div className="flex items-center space-x-2 pt-1 text-xs">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-600">Sim Lat</label>
              <input
                type="number"
                step="0.000001"
                value={simLat}
                onChange={(e) => handleManualChange(parseFloat(e.target.value) || 0, simLng)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-600">Sim Lng</label>
              <input
                type="number"
                step="0.000001"
                value={simLng}
                onChange={(e) => handleManualChange(simLat, parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            </div>
          </div>
          <p className="text-[11px] text-amber-800">
            ⚠️ <b>DEV MODE ACTIVE:</b> Yellow banner means client is submitting simulated coordinates to test server geofencing.
          </p>
        </div>
      )}
    </div>
  );
}
