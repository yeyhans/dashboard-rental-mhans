import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  PDF_COLORS,
  PDF_LAYOUT,
  PDF_SIZES,
  pdfStyles,
  px,
} from "../../utils/styles";

const styles = StyleSheet.create({
  box: {
    marginBottom: px(22),
    paddingVertical: px(16),
    paddingHorizontal: px(20),
    backgroundColor: PDF_COLORS.gray50,
    borderRadius: PDF_LAYOUT.radius,
  },
  label: { ...pdfStyles.label, marginBottom: px(6) },
  text: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.6,
    color: PDF_COLORS.gray600,
  },
});

/** Gray note card; renders nothing when the note is empty. */
export const NoteBox: React.FC<{ note?: string }> = ({ note }) => {
  if (!note || !note.trim()) return null;
  return (
    <View style={styles.box} wrap={false}>
      <Text style={styles.label}>Nota</Text>
      <Text style={styles.text}>{note}</Text>
    </View>
  );
};
