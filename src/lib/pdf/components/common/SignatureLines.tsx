import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, PDF_SIZES, px } from "../../utils/styles";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: px(48),
  },
  slot: { width: "46%" },
  line: {
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.ink,
    paddingTop: px(8),
  },
  caption: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.xs,
    color: PDF_COLORS.gray600,
  },
});

/** Two signature lines (stub for T3: processing document). */
export const SignatureLines: React.FC<{ left: string; right: string }> = ({
  left,
  right,
}) => (
  <View style={styles.row} wrap={false}>
    <View style={styles.slot}>
      <View style={styles.line}>
        <Text style={styles.caption}>{left}</Text>
      </View>
    </View>
    <View style={styles.slot}>
      <View style={styles.line}>
        <Text style={styles.caption}>{right}</Text>
      </View>
    </View>
  </View>
);
