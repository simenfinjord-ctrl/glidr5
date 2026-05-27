/**
 * Parses and interprets an application string.
 * Examples: "200c+wool" → "200°C + Ull/Wool", "*2" → "× 2 lag", "dip" → "Dip"
 */

export interface ParsedApplication {
  raw: string;
  interpreted: string; // Human-readable interpretation
  tempC?: number; // Extracted temperature in Celsius if any
  layers?: number; // Number of layers if specified
  components: string[]; // List of component descriptions
}

function parseSingleToken(token: string): string {
  const t = token.trim().toLowerCase();
  if (!t) return "";

  // Temperature: 200c, 200C, -5c, 120f etc.
  const tempMatch = t.match(/^(-?\d+(?:\.\d+)?)\s*([cf])$/);
  if (tempMatch) {
    const val = parseFloat(tempMatch[1]);
    const unit = tempMatch[2];
    if (unit === 'c') return `${val}°C`;
    if (unit === 'f') return `${val}°F`;
  }

  // Layers: *2, x2, 2x, 2lag, 2 layers
  const layerMatch = t.match(/^[x*×](\d+)$/) || t.match(/^(\d+)[x*×]$/);
  if (layerMatch) return `× ${layerMatch[1]} lag`;

  // Common keywords
  const keywords: Record<string, string> = {
    'wool': 'Ull/Wool',
    'ull': 'Ull/Wool',
    'horse': 'Hestehår/Horse hair',
    'horsehair': 'Hestehår/Horse hair',
    'dip': 'Dip',
    'dypp': 'Dip',
    'cork': 'Korking/Corking',
    'korking': 'Korking/Corking',
    'rub': 'Gnid/Rub',
    'gnid': 'Gnid/Rub',
    'brush': 'Børsting/Brush',
    'børst': 'Børsting/Brush',
    'nylon': 'Nylon-børst',
    'fiber': 'Fiber-børst',
    'infrared': 'Infrarød/Infrared',
    'ir': 'Infrarød/Infrared',
    'spray': 'Spray',
    'liquid': 'Liquid/Flytende',
    'powder': 'Pulver/Powder',
    'block': 'Blokk/Block',
    'melt': 'Smeltet/Melted',
    'scrape': 'Skrapt/Scraped',
    'clean': 'Rengjort/Clean',
    'base': 'Base',
    'top': 'Topping',
    'kick': 'Kick/Feste',
    'klister': 'Klister',
  };

  if (keywords[t]) return keywords[t];

  // Temperature with description: "200c wool" style already split by + or space
  return token.trim(); // Return as-is if not recognized
}

export function parseApplication(raw: string): ParsedApplication {
  if (!raw || !raw.trim()) return { raw, interpreted: "", components: [] };

  // Split by + or & to get components
  const parts = raw.split(/[+&]/).map(p => p.trim()).filter(Boolean);
  const components = parts.map(parseSingleToken).filter(Boolean);
  const interpreted = components.join(' + ');

  // Extract temperature
  const tempMatch = raw.match(/(-?\d+(?:\.\d+)?)\s*c\b/i);
  const tempC = tempMatch ? parseFloat(tempMatch[1]) : undefined;

  // Extract layers
  const layerMatch = raw.match(/[x*×](\d+)|(\d+)[x*×]/i);
  const layers = layerMatch ? parseInt(layerMatch[1] || layerMatch[2]) : undefined;

  return { raw, interpreted, tempC, layers, components };
}
