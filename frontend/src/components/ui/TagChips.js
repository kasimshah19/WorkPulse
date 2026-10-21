'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { RATING_TAGS_CATALOG } from '../../config/rating-tags.catalog';

export function TagChips({ type = 'WORKER_SKILL', selectedTags = [], onChange, max = 4, disabled = false }) {
  const tagsList = RATING_TAGS_CATALOG[type] || [];

  const handleToggle = (tagKey) => {
    if (disabled) return;
    if (selectedTags.includes(tagKey)) {
      onChange(selectedTags.filter((t) => t !== tagKey));
    } else {
      if (selectedTags.length >= max) return;
      onChange([...selectedTags, tagKey]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium">टैग्स चुनें (Select tags):</span>
        <span className={`font-semibold ${selectedTags.length >= max ? 'text-amber-400' : 'text-slate-400'}`}>
          {selectedTags.length}/{max} चुने गए
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {tagsList.map((tag) => {
          const isSelected = selectedTags.includes(tag.key);
          const IconComponent = LucideIcons[tag.icon] || LucideIcons.Tag;

          return (
            <button
              key={tag.key}
              type="button"
              disabled={disabled || (!isSelected && selectedTags.length >= max)}
              onClick={() => handleToggle(tag.key)}
              className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all active:scale-95 ${
                isSelected
                  ? 'bg-blue-600/25 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/20'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-600'
              } ${disabled || (!isSelected && selectedTags.length >= max) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <IconComponent className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{tag.labelHi}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TagChips;
