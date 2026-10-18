'use client';

import React from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { CalendarCheck, Camera, MapPin } from 'lucide-react';

export default function WorkerAttendancePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-500 flex items-center justify-center">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">हाजिरी प्रमाण (Proof-of-Work)</h1>
            <p className="text-xs text-slate-400">TODO Phase 4: GPS + Selfie check-in/out</p>
          </div>
        </div>

        <Card className="space-y-4 text-center py-8">
          <div className="flex justify-center gap-4 text-slate-400">
            <div className="flex items-center gap-1 text-xs">
              <MapPin className="w-4 h-4 text-brand-500" />
              <span>GPS Geofence</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Camera className="w-4 h-4 text-blue-500" />
              <span>Selfie Proof</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            TODO Phase 4: Check-in button enabled only when inside job site boundary.
          </p>

          <Button disabled className="w-full">
            चेक-इन करें (Check In)
          </Button>
        </Card>
      </main>

      <BottomNav role="worker" />
    </div>
  );
}
