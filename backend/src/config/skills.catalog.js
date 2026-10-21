import { SKILLS } from './constants.js';

/**
 * Standard Blue-Collar Skills Catalog
 * Defines display labels (English, Hindi, Marathi) and Lucide icon mappings for all canonical skills.
 */
export const SKILLS_CATALOG = Object.freeze([
  {
    key: 'mason',
    labelEn: 'Mason (Raj Mistri)',
    labelHi: 'राजमिस्त्री',
    labelMr: 'गवंडी',
    icon: 'Hammer',
  },
  {
    key: 'carpenter',
    labelEn: 'Carpenter (Badhai)',
    labelHi: 'बढ़ई',
    labelMr: 'सुतार',
    icon: 'Hammer',
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
    labelEn: 'Electrician (Bijli)',
    labelHi: 'इलेक्ट्रीशियन (बिजली)',
    labelMr: 'इलेक्ट्रिशियन (वीज)',
    icon: 'Zap',
  },
  {
    key: 'painter',
    labelEn: 'Painter (Rangai)',
    labelHi: 'पेंटर (रंग काम)',
    labelMr: 'रंगारी (पेंटर)',
    icon: 'Paintbrush',
  },
  {
    key: 'welder',
    labelEn: 'Welder',
    labelHi: 'वेल्डर (वेल्डिंग)',
    labelMr: 'वेल्डर',
    icon: 'Sparkles',
  },
  {
    key: 'tile_worker',
    labelEn: 'Tile Worker',
    labelHi: 'टाइल कारीगर',
    labelMr: 'फरशी कारागीर',
    icon: 'Layers',
  },
  {
    key: 'tile_layer',
    labelEn: 'Tile Layer (Flooring)',
    labelHi: 'टाइल लेयर (फर्श)',
    labelMr: 'फरशी बसवणारा',
    icon: 'Layers',
  },
  {
    key: 'laborer',
    labelEn: 'Laborer (Mazdoor)',
    labelHi: 'मजदूर',
    labelMr: 'मजूर',
    icon: 'HardHat',
  },
  {
    key: 'helper',
    labelEn: 'Helper (Assistant)',
    labelHi: 'हेल्पर (सहायक)',
    labelMr: 'मदतनीस',
    icon: 'HelpingHand',
  },
  {
    key: 'bar_bender',
    labelEn: 'Bar Bender (Sariya)',
    labelHi: 'सरिया कारीगर',
    labelMr: 'लोखंडी कामगार (बार बेंडर)',
    icon: 'Wrench',
  },
  {
    key: 'concrete_worker',
    labelEn: 'Concrete Worker (Dhalai)',
    labelHi: 'ढलाई कारीगर',
    labelMr: 'काँक्रीट कामगार',
    icon: 'Building',
  },
  {
    key: 'driver',
    labelEn: 'Driver',
    labelHi: 'ड्राइवर (चालक)',
    labelMr: 'चालक (ड्रायव्हर)',
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
    labelEn: 'Gardener (Mali)',
    labelHi: 'माली',
    labelMr: 'माळी',
    icon: 'Sprout',
  },
  {
    key: 'cook',
    labelEn: 'Cook (Rasoiya)',
    labelHi: 'रसोइया',
    labelMr: 'आचारी',
    icon: 'Utensils',
  },
]);

/** Lookup Map for fast access by skill key */
export const SKILLS_MAP = Object.freeze(
  SKILLS_CATALOG.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {})
);

export default SKILLS_CATALOG;
