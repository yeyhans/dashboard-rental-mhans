import React from "react";
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getLogoSource } from "../../core/fonts";
import {
  PDF_COLORS,
  PDF_SIZES,
  pdfLabelTracking,
  pdfStyles,
  px,
} from "../../utils/styles";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: px(18),
  },
  left: { flexDirection: "column" },
  logo: { height: px(28), width: px(28) * (2168 / 375), objectFit: "contain" },
  caption: {
    marginTop: px(8),
    fontFamily: "IBM Plex Mono",
    fontWeight: 500,
    fontSize: PDF_SIZES.xxs,
    letterSpacing: pdfLabelTracking(PDF_SIZES.xxs),
    textTransform: "uppercase",
    color: PDF_COLORS.gray400,
  },
  right: { flexDirection: "column", alignItems: "flex-end" },
  title: {
    fontFamily: "Archivo",
    fontWeight: 900,
    fontSize: PDF_SIZES.xxl,
    letterSpacing: -0.45,
    color: PDF_COLORS.ink,
  },
  date: {
    marginTop: px(8),
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
    fontSize: PDF_SIZES.xs,
    letterSpacing: 0.4,
    color: PDF_COLORS.gray400,
  },
});

interface DocHeaderProps {
  /** Small mono caption under the logo, e.g. "Presupuesto de arriendo". */
  label: string;
  /** Big title on the right, e.g. "Pedido #420". */
  title: string;
  /** Right-hand mono line, e.g. "Fecha: 16-05-2026". */
  dateLine: string;
}

/** Logo + caption on the left, order title + date on the right, hairline underneath. */
export const DocHeader: React.FC<DocHeaderProps> = ({
  label,
  title,
  dateLine,
}) => (
  <View>
    <View style={styles.row}>
      <View style={styles.left}>
        <Image src={getLogoSource()} style={styles.logo} />
        <Text style={styles.caption}>{label}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>{dateLine}</Text>
      </View>
    </View>
    <View style={pdfStyles.hairline} />
  </View>
);
