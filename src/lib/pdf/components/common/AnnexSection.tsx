import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, PDF_SIZES, pdfStyles, px } from "../../utils/styles";

const styles = StyleSheet.create({
  wrapper: { marginTop: px(32) },
  heading: { ...pdfStyles.label, marginBottom: px(10) },
  body: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.xs,
    lineHeight: 1.7,
    color: PDF_COLORS.gray600,
  },
});

/** Annex block (stub for T3: "Anexo de contrato" of the processing document). */
export const AnnexSection: React.FC<{
  title: string;
  paragraphs: string[];
}> = ({ title, paragraphs }) => (
  <View style={styles.wrapper}>
    <Text style={styles.heading}>{title}</Text>
    {paragraphs.map((paragraph, index) => (
      <Text key={index} style={[styles.body, { marginBottom: px(8) }]}>
        {paragraph}
      </Text>
    ))}
  </View>
);
