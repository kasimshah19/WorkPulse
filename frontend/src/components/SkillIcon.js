'use client';

import React from 'react';
import {
  Paintbrush,
  Wrench,
  Hammer,
  Zap,
  Sparkles,
  Layers,
  HardHat,
  HandHelping,
  Building,
  Truck,
  Sprout,
  Utensils,
  Briefcase,
} from 'lucide-react';

const ICON_MAP = {
  Paintbrush,
  Wrench,
  Hammer,
  Zap,
  Sparkles,
  Layers,
  HardHat,
  HelpingHand: HandHelping,
  HandHelping,
  Building,
  Truck,
  Sprout,
  Utensils,
};

export default function SkillIcon({ name, className = 'w-5 h-5' }) {
  const IconComp = ICON_MAP[name] || HardHat;
  return <IconComp className={className} />;
}
