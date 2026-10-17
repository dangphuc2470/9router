// Apple Dark Mode Palette (Human Interface Guidelines) matching Turing Monitor
export const COLOR_BG = "#0c0d11";              // Apple Deep Neutral Background
export const COLOR_CARD_BG = "#16181e";         // Apple Secondary Grouped Background
export const COLOR_CARD_BORDER = "#262934";     // Apple Subtle Hairline Stroke
export const COLOR_CARD_ACTIVE_BG = "#182234";  // Apple Dark Navy Blue for active card
export const COLOR_CARD_ACTIVE_BORDER = "#2a3a56"; // Subtle matching border
export const COLOR_TRACK_BG = "#23252e";        // Control Center Slider Track

export const COLOR_TEXT_PRIMARY = "#FFFFFF";
export const COLOR_TEXT_SECONDARY = "#989ba6";
export const COLOR_TEXT_TERTIARY = "#707380";

export const COLOR_APPLE_GREEN = "#30D158";
export const COLOR_APPLE_ORANGE = "#FF9F0A";
export const COLOR_APPLE_RED = "#FF453A";
export const COLOR_APPLE_BLUE = "#0A84FF";
export const COLOR_APPLE_PURPLE = "#BF5AF2";
export const COLOR_APPLE_TEAL = "#64D2FF";
export const COLOR_APPLE_PINK = "#FF375F";
export const COLOR_APPLE_INDIGO = "#5E5CE6";

export const COLOR_PUBG_RED = "#eb3b35"; // Red damage chunk for consumed quota

export const AVATAR_PALETTE = [
  COLOR_APPLE_BLUE,
  COLOR_APPLE_PURPLE,
  COLOR_APPLE_INDIGO,
  COLOR_APPLE_TEAL,
  COLOR_APPLE_PINK,
  COLOR_APPLE_ORANGE,
];

export function getStatusColor(pct) {
  if (pct >= 50) return COLOR_APPLE_GREEN;
  if (pct >= 20) return COLOR_APPLE_ORANGE;
  return COLOR_APPLE_RED;
}

export function truncateMiddle(text, maxLen = 16) {
  if (!text || text.length <= maxLen) return text;
  const sLen = Math.min(2, Math.max(1, Math.floor(text.length / 4)));
  const prefixLen = maxLen - sLen - 3;
  if (prefixLen <= 1) return `${text.slice(0, 2)}...${text.slice(-sLen)}`;
  return `${text.slice(0, prefixLen)}...${text.slice(-sLen)}`;
}

export function formatResetTime(resetStr) {
  if (!resetStr) return "";
  try {
    const cleanStr = resetStr.replace("Z", "+00:00");
    const target = new Date(cleanStr);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const totalSec = Math.floor(diffMs / 1000);
    if (totalSec <= 0) return "soon";
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  } catch {
    return "";
  }
}
