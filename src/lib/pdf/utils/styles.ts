import { StyleSheet } from "@react-pdf/renderer";

/**
 * Common styles shared across all PDF types
 */
export const commonStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 12,
    padding: 30,
    backgroundColor: "#ffffff",
  },

  header: {
    marginBottom: 20,
    borderBottom: "2pt solid #000000",
    paddingBottom: 15,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },

  infoGrid: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 4,
    marginBottom: 20,
  },

  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },

  infoLabel: {
    fontWeight: "bold",
    minWidth: 120,
    color: "#555555",
    fontSize: 11,
  },

  infoValue: {
    color: "#333333",
    fontSize: 11,
  },

  table: {
    width: "100%",
    marginBottom: 20,
  },

  tableHeader: {
    backgroundColor: "#e8e7e7",
    flexDirection: "row",
    padding: 8,
    fontWeight: "bold",
    fontSize: 11,
  },

  tableRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #dddddd",
    padding: 8,
    fontSize: 10,
  },

  tableCell: {
    flex: 1,
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
    borderTop: "1pt solid #dddddd",
    paddingTop: 10,
  },
});

/**
 * Budget PDF specific styles
 */
export const budgetStyles = StyleSheet.create({
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 25,
    paddingBottom: 15,
    borderBottom: "2pt solid #000000",
  },

  clientInfo: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 6,
    marginBottom: 20,
  },

  projectInfo: {
    backgroundColor: "#e3f2fd",
    padding: 15,
    borderRadius: 6,
    marginBottom: 20,
  },

  summaryTable: {
    marginLeft: "auto",
    width: "50%",
    marginTop: 15,
  },

  totalRow: {
    backgroundColor: "#007bff",
    color: "#ffffff",
    fontWeight: "bold",
    padding: 10,
  },

  reserveRow: {
    backgroundColor: "#28a745",
    color: "#ffffff",
    fontWeight: "bold",
    padding: 10,
  },

  companyInfoSection: {
    backgroundColor: "#f1f3f4",
    padding: 15,
    borderRadius: 6,
    marginTop: 20,
    borderLeft: "4pt solid #007bff",
  },

  warningBox: {
    backgroundColor: "#f8f9fa",
    color: "#000000",
    padding: 15,
    borderRadius: 6,
    border: "1pt solid #ffffff",
    marginTop: 15,
    fontSize: 10,
  },
});

/**
 * Processing PDF styles (SVG-based with absolute positioning)
 */
export const processingStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    position: "relative",
  },

  absoluteText: {
    position: "absolute",
  },

  orderHeader: {
    fontSize: 36,
    fontWeight: "bold",
  },

  fieldLabel: {
    fontSize: 15,
  },

  itemName: {
    fontSize: 13,
  },

  totalLabel: {
    fontSize: 15,
    fontWeight: "bold",
  },
});

/**
 * Contract PDF specific styles
 */
export const contractStyles = StyleSheet.create({
  contractPage: {
    fontFamily: "Helvetica",
    padding: 40,
    lineHeight: 1.4,
  },

  contractHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
    paddingBottom: 20,
    borderBottom: "2pt solid #000000",
  },

  contractTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },

  legalText: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 10,
    textAlign: "justify",
  },

  signatureSection: {
    marginTop: 60,
    flexDirection: "row",
    justifyContent: "space-around",
  },

  signatureBlock: {
    width: "40%",
    textAlign: "center",
  },

  signatureLine: {
    borderTop: "1pt solid #707070",
    marginTop: 80,
    paddingTop: 10,
    fontSize: 11,
  },

  userInfoSection: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 6,
    marginBottom: 25,
  },
});

// ---------------------------------------------------------------------------------------------
// "MarioHans OS" design tokens (client HTML templates). The templates are drawn on a 780 px card;
// an A4 page has 515 pt of content width, so every px size is scaled by PX_TO_PT (≈ 515 / 700).
// ---------------------------------------------------------------------------------------------

/** px (HTML template) → pt (PDF). */
export const PX_TO_PT = 0.72;
export const px = (value: number): number =>
  Math.round(value * PX_TO_PT * 10) / 10;

export const PDF_COLORS = {
  ink: "#0A0A0A",
  inkSoft: "#1A1A1A",
  gray50: "#FAFAFA",
  gray100: "#F4F4F4",
  gray150: "#EAEAEA",
  gray200: "#E2E2E2",
  gray400: "#848585",
  gray500: "#666666",
  gray600: "#4E504F",
  white: "#FFFFFF",
} as const;

export const PDF_SIZES = {
  xxs: px(11),
  xs: px(12),
  sm: px(13),
  md: px(15),
  lg: px(18),
  xl: px(22),
  xxl: px(28),
} as const;

export const PDF_LAYOUT = {
  pageMarginX: 40,
  pageMarginTop: 28,
  pageMarginBottom: 32,
  radius: 8,
  /** Content width of an A4 page (595.28 pt) minus both horizontal margins. */
  contentWidth: 515,
} as const;

/** Spanish-friendly letter spacing for uppercase mono labels (0.06em). */
const labelTracking = (size: number) => Math.round(size * 0.06 * 100) / 100;

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    color: PDF_COLORS.ink,
    backgroundColor: PDF_COLORS.white,
    paddingTop: PDF_LAYOUT.pageMarginTop,
    paddingBottom: PDF_LAYOUT.pageMarginBottom,
    paddingHorizontal: PDF_LAYOUT.pageMarginX,
  },
  /** Mono uppercase caption, e.g. "INFORMACIÓN DE CLIENTE". */
  label: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    fontSize: PDF_SIZES.xxs,
    letterSpacing: labelTracking(PDF_SIZES.xxs),
    textTransform: "uppercase",
    color: PDF_COLORS.gray500,
  },
  hairline: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray150,
    borderBottomStyle: "solid",
  },
  mono: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
  },
});

export const pdfLabelTracking = labelTracking;
