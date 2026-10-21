/**
 * Frontend skills catalog
 * Mirrors backend/src/config/skills.catalog.js for offline immediate display
 */
export const FRONTEND_SKILLS_CATALOG = [
  {
    key: 'painter',
    labelEn: 'Painter',
    labelHi: 'पेंटर (रंग काम)',
    labelMr: 'रंगारी (पेंटर)',
    icon: 'Paintbrush',
  },
  {
    key: 'plumber',
    labelEn: 'Plumber',
    labelHi: 'प्लंबर (नल कारीगर)',
    labelMr: 'नळ कारागीर',
    icon: 'Wrench',
  },
  {
    key: 'electrician',
    labelEn: 'Electrician',
    labelHi: 'इलेक्ट्रीशियन (बिजली)',
    labelMr: 'इलेक्ट्रिशियन (वीज)',
    icon: 'Zap',
  },
  {
    key: 'mason',
    labelEn: 'Mason (Raj Mistri)',
    labelHi: 'राजमिस्त्री',
    labelMr: 'गवंडी',
    icon: 'Hammer',
  },
  {
    key: 'carpenter',
    labelEn: 'Carpenter',
    labelHi: 'बढ़ई (लकड़ी काम)',
    labelMr: 'सुतार',
    icon: 'Hammer',
  },
  {
    key: 'helper',
    labelEn: 'Helper',
    labelHi: 'हेल्पर (सहायक)',
    labelMr: 'मदतनीस',
    icon: 'HelpingHand',
  },
  {
    key: 'laborer',
    labelEn: 'Laborer',
    labelHi: 'मजदूर',
    labelMr: 'मजूर',
    icon: 'HardHat',
  },
  {
    key: 'welder',
    labelEn: 'Welder',
    labelHi: 'वेल्डर (वेल्डिंग)',
    labelMr: 'वेल्डर',
    icon: 'Sparkles',
  },
  {
    key: 'tile_layer',
    labelEn: 'Tile Layer',
    labelHi: 'टाइल लेयर (फर्श)',
    labelMr: 'फरशी बसवणारा',
    icon: 'Layers',
  },
  {
    key: 'tile_worker',
    labelEn: 'Tile Worker',
    labelHi: 'टाइल कारीगर',
    labelMr: 'फरशी कारागीर',
    icon: 'Layers',
  },
  {
    key: 'bar_bender',
    labelEn: 'Bar Bender',
    labelHi: 'सरिया कारीगर',
    labelMr: 'लोखंडी कामगार',
    icon: 'Wrench',
  },
  {
    key: 'concrete_worker',
    labelEn: 'Concrete Worker',
    labelHi: 'ढलाई कारीगर',
    labelMr: 'काँक्रीट कामगार',
    icon: 'Building',
  },
  {
    key: 'driver',
    labelEn: 'Driver',
    labelHi: 'ड्राइवर',
    labelMr: 'चालक',
    icon: 'Truck',
  },
  {
    key: 'cleaner',
    labelEn: 'Cleaner',
    labelHi: 'सफाई कर्मचारी',
    labelMr: 'स्वच्छता कामगार',
    icon: 'Sparkles',
  },
  {
    key: 'gardener',
    labelEn: 'Gardener',
    labelHi: 'माली',
    labelMr: 'माळी',
    icon: 'Sprout',
  },
  {
    key: 'cook',
    labelEn: 'Cook',
    labelHi: 'रसोइया',
    labelMr: 'आचारी',
    icon: 'Utensils',
  },
];

export const FRONTEND_SKILLS_MAP = FRONTEND_SKILLS_CATALOG.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});
