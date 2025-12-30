/**
 * SVG to React-PDF coordinate translation utilities
 * Critical for Processing PDF which uses SVG-based layout
 */

export interface SVGToPointsConfig {
  svgWidth: number;
  svgHeight: number;
  pageWidth: number; // points
  pageHeight: number; // points
}

// A4 page configuration
// Processing PDF uses viewBox="0 0 1400 {dynamicHeight}"
// A4 in points: 595.28 x 841.89 (1 point = 1/72 inch)
export const A4_CONFIG: SVGToPointsConfig = {
  svgWidth: 1400,
  svgHeight: 1500, // base height
  pageWidth: 595.28,
  pageHeight: 841.89,
};

/**
 * Convert SVG X coordinate to React-PDF points
 */
export function svgXToPoints(svgX: number, config = A4_CONFIG): number {
  return (svgX / config.svgWidth) * config.pageWidth;
}

/**
 * Convert SVG Y coordinate to React-PDF points
 */
export function svgYToPoints(svgY: number, config = A4_CONFIG): number {
  return (svgY / config.svgHeight) * config.pageHeight;
}

/**
 * Convert SVG font size to React-PDF points
 * Font sizes need scaling with adjustment factor
 */
export function svgFontSizeToPoints(
  svgFontSize: number,
  config = A4_CONFIG
): number {
  // 0.8 adjustment factor for better visual match
  return (svgFontSize / config.svgWidth) * config.pageWidth * 0.8;
}

/**
 * Helper for positioning text/view elements with absolute positioning
 * Returns style object compatible with React-PDF
 */
export function svgPositionToStyle(
  svgX: number,
  svgY: number,
  config = A4_CONFIG
) {
  return {
    position: 'absolute' as const,
    left: svgXToPoints(svgX, config),
    top: svgYToPoints(svgY, config),
  };
}

/**
 * Convert SVG dimensions (width/height) to points
 */
export function svgWidthToPoints(svgWidth: number, config = A4_CONFIG): number {
  return (svgWidth / config.svgWidth) * config.pageWidth;
}

export function svgHeightToPoints(
  svgHeight: number,
  config = A4_CONFIG
): number {
  return (svgHeight / config.svgHeight) * config.pageHeight;
}

/**
 * Create custom config for dynamic page heights
 */
export function createCustomConfig(
  svgHeight: number
): SVGToPointsConfig {
  return {
    ...A4_CONFIG,
    svgHeight,
  };
}
