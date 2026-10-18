'use client';

import React from 'react';
import Link from 'next/link';
import { HardHat, Building2, ShieldCheck, Zap, PhoneCall } from 'lucide-react';
import { BigIconButton } from '../components/ui/BigIconButton';

export default function HomePage() {
  return (
    <div className="w-full px-4 pt-6 pb-12 flex flex-col justify-between min-h-[85vh]">
      {/* Hero Section */}
      <div className="text-center space-y-3 mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>सुरक्षित एस्क्रो भुगतान • 100% Guaranteed</span>
        </div>

        <h1 className="text-3xl font-black text-white tracking-tight">
          Work<span className="text-blue-500">Pulse</span>
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
            <span className="font-bold text-white block">रियल-टाइम जॉब मैच (5 km)</span>
            <span>नजदीकी उपलब्ध कारीगरों को सेकंडों में अलर्ट</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white block">100% एस्क्रो सुरक्षा</span>
            <span>काम पूरा होने पर तुरंत वॉलेट में दिहाड़ी क्रेडिट</span>
          </div>
        </div>
      </div>
    </div>
  );
}
