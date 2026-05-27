/**
 * Parses and interprets an application string.
 *
 * Examples:
 *   "200c+wool"      → "200°C + Ull/Wool"
 *   "rub 130c"       → "Gnid/Rub 130°C"
 *   "easy scrape"    → "Lett skraping/Easy scrape"
 *   "*2"             → "× 2 lag"
 *   "dip+cork"       → "Dip + Korking/Corking"
 *   "whole+*2"       → "Hel ski/Whole + × 2 ganger"
 *   "back only"      → "Bakre del/Back only"
 *   "front/back"     → "Forreste/Front + Bakre/Back"
 */

export interface ParsedApplication {
  raw: string;
  interpreted: string;
  tempC?: number;
  layers?: number;
  components: string[];
}

// ── Multi-word keyword map (checked BEFORE splitting by space) ────────────────
const MULTI_WORD_KEYWORDS: Record<string, string> = {
  'easy scrape':     'Lett skraping/Easy scrape',
  'lett skraping':   'Lett skraping/Easy scrape',
  'back only':       'Bakre del/Back only',
  'front only':      'Forreste del/Front only',
  'front/back':      'Forreste/Front + Bakre/Back',
  'back/front':      'Bakre/Back + Forreste/Front',
  'horse hair':      'Hestehår/Horse hair',
  'horse hår':       'Hestehår/Horse hair',
};

// ── Single-word / single-token keyword map ────────────────────────────────────
const KEYWORDS: Record<string, string> = {
  // Techniques
  'scrape':       'Skraping/Scrape',
  'skrap':        'Skraping/Scrape',
  'skraping':     'Skraping/Scrape',
  'rub':          'Gnid/Rub',
  'gnid':         'Gnid/Rub',
  'dip':          'Dip',
  'dypp':         'Dip',
  'cork':         'Korking/Corking',
  'korking':      'Korking/Corking',
  'brush':        'Børsting/Brush',
  'børst':        'Børsting/Brush',
  'nylon':        'Nylon-børst',
  'fiber':        'Fiber-børst',
  'infrared':     'Infrarød/Infrared',
  'ir':           'Infrarød/Infrared',
  'spray':        'Spray',
  'liquid':       'Liquid/Flytende',
  'powder':       'Pulver/Powder',
  'block':        'Blokk/Block',
  'melt':         'Smeltet/Melted',
  'clean':        'Rengjort/Clean',
  'base':         'Base',
  'top':          'Topping',
  'kick':         'Kick/Feste',
  'klister':      'Klister',
  // Materials
  'wool':         'Ull/Wool',
  'ull':          'Ull/Wool',
  'horse':        'Hestehår/Horse hair',
  'horsehair':    'Hestehår/Horse hair',
  // Rillejern / structure iron zones
  'whole':        'Hel ski/Whole',
  'hel':          'Hel ski/Whole',
  'back':         'Bakre del/Back',
  'bak':          'Bakre del/Back',
  'front':        'Forreste del/Front',
  'frem':         'Forreste del/Front',
  'turn':         'Snu/Turn',
  'snu':          'Snu/Turn',
};

// ── Parse a single token (no + or & separators, no spaces) ───────────────────
function parseSingleToken(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return '';

  // Temperature: 200c, -5c, 130f
  const tempMatch = t.match(/^(-?\d+(?:\.\d+)?)\s*([cf])$/);
  if (tempMatch) {
    const val = parseFloat(tempMatch[1] ?? '0');
    const unit = tempMatch[2] ?? 'c';
    return unit === 'f' ? `${val}°F` : `${val}°C`;
  }

  // Layers / passes: *2, x2, 2x, ×3
  const layerMatch = t.match(/^[x*×](\d+)$/) || t.match(/^(\d+)[x*×]$/);
  if (layerMatch) {
    const num = layerMatch[1] ?? layerMatch[2] ?? '?';
    return `× ${num} stryk`;
  }

  // Bare number with no unit → interpret as Celsius (e.g. "200" → "200°C")
  const bareNumMatch = t.match(/^(-?\d+(?:\.\d+)?)$/);
  if (bareNumMatch) {
    const val = parseFloat(bareNumMatch[1] ?? '0');
    return `${val}°C`;
  }

  if (KEYWORDS[t]) return KEYWORDS[t];

  return raw.trim(); // Return as-is if not recognized
}

// ── Parse a component that may contain spaces ─────────────────────────────────
// e.g. "rub 130c" → "Gnid/Rub 130°C"
// e.g. "back only" → "Bakre del/Back only"  (caught by MULTI_WORD_KEYWORDS)
function parseComponent(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return '';

  // Check multi-word keywords first (exact match)
  if (MULTI_WORD_KEYWORDS[t]) return MULTI_WORD_KEYWORDS[t];

  // If no spaces, parse as single token
  if (!t.includes(' ') && !t.includes('/')) {
    return parseSingleToken(raw);
  }

  // Handle "word/word" (e.g. "front/back") — split on slash
  if (t.includes('/') && !t.match(/\d+[cf]$/)) {
    const slashParts = raw.split('/').map(p => parseSingleToken(p));
    return slashParts.join(' + ');
  }

  // Space-separated sub-tokens: parse each and join with space
  // e.g. "rub 130c" → ["Gnid/Rub", "130°C"] → "Gnid/Rub 130°C"
  const words = raw.trim().split(/\s+/);
  const parsed = words.map(w => parseSingleToken(w));
  return parsed.join(' ');
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseApplication(raw: string): ParsedApplication {
  if (!raw || !raw.trim()) return { raw, interpreted: '', components: [] };

  // Split by + or & to get top-level components
  const parts = raw.split(/[+&]/).map(p => p.trim()).filter(Boolean);
  const components = parts.map(parseComponent).filter(Boolean);
  const interpreted = components.join(' + ');

  // Extract temperature (first occurrence)
  const tempMatch = raw.match(/(-?\d+(?:\.\d+)?)\s*c\b/i);
  const tempC = tempMatch ? parseFloat(tempMatch[1] ?? '0') : undefined;

  // Extract layers
  const layerMatch = raw.match(/[x*×](\d+)|(\d+)[x*×]/i);
  const layers = layerMatch ? parseInt(layerMatch[1] ?? layerMatch[2] ?? '0', 10) : undefined;

  return { raw, interpreted, tempC, layers, components };
}
