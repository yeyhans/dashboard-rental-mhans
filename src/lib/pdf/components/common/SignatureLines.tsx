import React from "react";
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { REPRESENTATION_LABEL } from "../../content/annexCopy";
import {
  PDF_COLORS,
  PDF_SIZES,
  pdfLabelTracking,
  px,
} from "../../utils/styles";

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginTop: px(40) },
  slot: { flex: 1 },
  gap: { marginRight: 48 },
  imageSlot: { height: 50, justifyContent: "flex-end" },
  image: { width: 120, height: 50, objectFit: "contain", objectPosition: "left bottom" },
  rule: { height: 1, backgroundColor: PDF_COLORS.ink, marginBottom: px(10) },
  name: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.4,
    color: PDF_COLORS.ink,
  },
  mono: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
    fontSize: PDF_SIZES.xs,
    lineHeight: 1.5,
    color: PDF_COLORS.gray500,
  },
  parent: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    fontSize: PDF_SIZES.xxs,
    lineHeight: 1,
    letterSpacing: pdfLabelTracking(PDF_SIZES.xxs),
    color: PDF_COLORS.gray400,
    marginTop: px(10),
    marginBottom: px(5),
  },
  company: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.4,
    color: PDF_COLORS.gray600,
  },
});

export interface SignatureParty {
  name: string;
  /** Full line, e.g. "Cédula N° 16.135.586-0". */
  cedula: string;
  company?: string;
  /** Full line, e.g. "RUT N° 77.892.569-9". */
  companyRut?: string;
}

/** Two signature columns (1 pt ink rule above each name); never split across pages. */
export const SignatureLines: React.FC<{
  left: SignatureParty;
  right: SignatureParty;
  /** Optional signature image above each rule (remote URL). */
  images?: { left?: string; right?: string };
}> = ({ left, right, images }) => {
  const hasImages = Boolean(images?.left || images?.right);
  return (
  <View style={styles.row} wrap={false}>
    {[left, right].map((party, index) => {
      const image = index === 0 ? images?.left : images?.right;
      return (
      <View key={index} style={[styles.slot, index === 0 ? styles.gap : {}]}>
        {hasImages ? (
          <View style={styles.imageSlot}>
            {image ? <Image src={image} style={styles.image} /> : null}
          </View>
        ) : null}
        <View style={styles.rule} />
        <Text style={styles.name}>{party.name}</Text>
        <Text style={[styles.mono, { marginTop: px(2) }]}>{party.cedula}</Text>
        {party.company ? (
          <>
            <Text style={styles.parent}>
              {REPRESENTATION_LABEL.toUpperCase()}
            </Text>
            <Text style={styles.company}>{party.company}</Text>
            {party.companyRut ? (
              <Text style={styles.mono}>{party.companyRut}</Text>
            ) : null}
          </>
        ) : null}
      </View>
      );
    })}
  </View>
  );
};
