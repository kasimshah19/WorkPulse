'use client';

import React from 'react';
import { Star } from 'lucide-react';

const RATING_STEPS = [
  { value: 1, emoji: '😠', label: 'बहुत खराब (Very Poor)' },
  { value: 2, emoji: '🙁', label: 'खराब (Poor)' },
  { value: 3, emoji: '😐', label: 'ठीक-ठाक (Average)' },
  { value: 4, emoji: '🙂', label: 'अच्छा (Good)' },
  { value: 5, emoji: '🤩', label: 'बहुत अच्छा (Excellent)' },
];

export function StarInput({ value = 0, onChange, disabled = false, id = 'star-rating' }) {
  const [hoverValue, setHoverValue] = React.useState(0);

  const activeScore = hoverValue || value;
  const currentStep = RATING_STEPS.find((s) => s.value === activeScore);

  const handleKeyDown = (e, val) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(val);
    } else if (e.key === 'ArrowRight' && val < 5) {
      e.preventDefault();
      onChange(val + 1);
    } else if (e.key === 'ArrowLeft' && val > 1) {
      e.preventDefault();
      onChange(val - 1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 py-2" id={id}>
      <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Rating Stars">
        {RATING_STEPS.map((step) => {
          const isFilled = step.value <= activeScore;
          return (
            <button
              key={step.value}
              type="button"
              role="radio"
              aria-checked={value === step.value}
              aria-label={`${step.value} Star - ${step.label}`}
              disabled={disabled}
              onClick={() => onChange && onChange(step.value)}
              onMouseEnter={() => !disabled && setHoverValue(step.value)}
              onMouseLeave={() => !disabled && setHoverValue(0)}
              onKeyDown={(e) => handleKeyDown(e, step.value)}
              className={`w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl flex items-center justify-center transition-all transform active:scale-90 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                isFilled
                  ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-400/80 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-slate-800/80 text-slate-500 border border-slate-700 hover:border-slate-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  isFilled ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="min-h-[28px] text-center">
        {currentStep ? (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-amber-300 font-bold text-sm border border-slate-700">
            <span className="text-base">{currentStep.emoji}</span>
            <span>{currentStep.label}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400 font-medium">
            स्टार चुनकर रेटिंग दें (Tap star to rate)
          </span>
        )}
      </div>
    </div>
  );
}

export default StarInput;
