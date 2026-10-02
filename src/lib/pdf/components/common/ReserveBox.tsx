import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_COLORS, PDF_LAYOUT, PDF_SIZES, px } from "../../utils/styles";
import { formatCLP } from "../../utils/formatters";

const styles = StyleSheet.create({
  box: {
    marginTop: px(18),
    paddingVertical: px(14),
    paddingHorizontal: px(20),
    borderRadius: PDF_LAYOUT.radius,
    backgroundColor: PDF_COLORS.gray150,
    flexDirection: "column",
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  gap: { marginBottom: px(8) },
  strong: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: PDF_SIZES.sm,
    color: PDF_COLORS.ink,
  },
  regular: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    color: PDF_COLORS.ink,
  },
  amount: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
    fontSize: PDF_SIZES.md,
    color: PDF_COLORS.ink,
  },
});

interface ReserveBoxProps {
  /** "Reserva 25%" or "Reserva" (fixed amount). */
  reserveLabel: string;
  reserve: number;
  balance: number;
}

/** Gray card with the reserve to pay now and the balance due on return. */
export const ReserveBox: React.FC<ReserveBoxProps> = ({
  reserveLabel,
  reserve,
  balance,
}) => (
  <View style={styles.box}>
    <View style={[styles.line, styles.gap]}>
      <Text style={styles.strong}>{reserveLabel}</Text>
      <Text style={styles.amount}>{formatCLP(reserve)}</Text>
    </View>
    <View style={styles.line}>
      <Text style={styles.regular}>Saldo pendiente</Text>
      <Text style={styles.amount}>{formatCLP(balance)}</Text>
    </View>
  </View>
);
