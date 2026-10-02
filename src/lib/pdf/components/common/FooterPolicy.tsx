import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, px } from "../../utils/styles";

const styles = StyleSheet.create({
  wrapper: {
    marginTop: px(14),
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gray150,
    paddingTop: px(14),
  },
  text: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: px(12),
    lineHeight: 1.55,
    color: PDF_COLORS.ink,
  },
});

/** Pickup / return policy paragraph closing the document. */
export const FooterPolicy: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.wrapper} wrap={false}>
    <Text style={styles.text}>{text}</Text>
  </View>
);
