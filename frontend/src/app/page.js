'use client';

import React from 'react';
import Link from 'next/link';
import { HardHat, Building2, ShieldCheck, Zap, PhoneCall } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { BigIconButton } from '../components/ui/BigIconButton';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-6 pb-12 flex flex-col justify-between">
        {/* Hero Section */}
        <div className="text-center space-y-3 mt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>सुरक्षित एस्क्रो भुगतान • 100% Guaranteed</span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight">
            Work<span className="text-brand-500">Pulse</span>
          </h1>

          <p className="text-sm text-slate-300 font-medium px-4 leading-relaxed">
            दैनिक मजदूरों और ठेकेदारों के लिए सीधा काम, उपस्थिति प्रमाण और सुरक्षित भुगतान।
          </p>
          <p className="text-xs text-slate-400 font-normal">
            Direct micro-contracting, proof-of-work & escrow payments for India.
          </p>
        </div>

        {/* Persona Choice - Big CTA Buttons */}
        <div className="my-8 space-y-4">
          <Link href="/worker/dashboard" className="block focus:outline-none">
            <BigIconButton
              icon={HardHat}
              title="मैं मजदूर हूँ (Worker)"
              subtitle="काम ढूंढें • सीधा बैंक/UPI भुगतान पाएं"
              variant="primary"
            />
          </Link>

          <Link href="/contractor/dashboard" className="block focus:outline-none">
            <BigIconButton
              icon={Building2}
              title="मैं ठेकेदार हूँ (Contractor)"
              subtitle="कारीगर खोजें • सुरक्षित एस्क्रो जमा करें"
              variant="contractor"
            />
          </Link>
        </div>

        {/* Value Highlights */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">त्वरित काम और हाजिरी</p>
              <p className="text-slate-400">GPS और सेल्फी से प्रमाणित उपस्थिति</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 border-t border-slate-800/60 pt-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">आवाज़ से खोज (Voice Matching)</p>
              <p className="text-slate-400">Phase 5: बोलकर अपना काम और हुनर बताएं</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-6 text-[11px] text-slate-400">
          WorkPulse v0.0 • Phase 0 Scaffold
        </div>
      </main>
    </div>
  );
}
