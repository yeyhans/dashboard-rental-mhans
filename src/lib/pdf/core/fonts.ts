import { Font } from '@react-pdf/renderer';

/**
 * Register fonts for PDF generation
 * Using Helvetica (built-in) as primary font family
 */
export function registerFonts() {
  // Helvetica is built-in to React-PDF, no registration needed
  // This function exists for future custom font registration if needed

  console.log('📝 Using Helvetica font family (built-in)');
}

// Font family constants
export const FONT_FAMILIES = {
  primary: 'Helvetica',
  primaryBold: 'Helvetica-Bold',
} as const;

export const FONT_SIZES = {
  small: 9,
  normal: 12,
  medium: 14,
  large: 17,
  xlarge: 20,
  xxlarge: 24,
  huge: 32,
} as const;
