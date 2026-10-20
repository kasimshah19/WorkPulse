import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with clsx and merges Tailwind conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formats integer paise into Indian Rupee format, e.g. 50000 -> ₹500
 */
export function formatRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0';
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Formats integer paise with decimal fractions if needed, e.g. 50050 -> ₹500.50
 */
export function formatRupeesWithPaise(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Parses user input in rupees to integer paise
 */
export function parseRupeesToPaise(rupeesStr) {
  if (!rupeesStr) return 0;
  const cleaned = String(rupeesStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}
