import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  BudgetDiscountInfo,
  BudgetShippingInfo,
  BudgetTotals,
} from "../../core/types";
import { PDF_COLORS, PDF_SIZES, px } from "../../utils/styles";
import { formatCLP } from "../../utils/formatters";

const styles = StyleSheet.create({
  outer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: px(24),
  },
  box: { width: px(320), flexDirection: "column" },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: px(8),
  },
  label: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.4,
    color: PDF_COLORS.gray600,
  },
  value: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    color: PDF_COLORS.gray600,
  },
  hairline: {
    height: 1,
    backgroundColor: PDF_COLORS.gray150,
    marginTop: px(4),
    marginBottom: px(12),
  },
  inkRule: {
    height: 1,
    backgroundColor: PDF_COLORS.ink,
    marginTop: px(-2),
    marginBottom: px(8),
  },
  totalLabel: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: PDF_SIZES.lg,
    color: PDF_COLORS.ink,
  },
  totalValue: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    fontSize: PDF_SIZES.lg,
    color: PDF_COLORS.ink,
  },
});

interface TotalsBlockProps {
  totals: BudgetTotals;
  discount: BudgetDiscountInfo;
  shipping: BudgetShippingInfo;
}

const Line: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.line}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{formatCLP(value)}</Text>
  </View>
);

/** Right-aligned 320 px totals card. Discount and shipping rows only appear when > 0. */
export const TotalsBlock: React.FC<TotalsBlockProps> = ({
  totals,
  discount,
  shipping,
}) => (
  <View style={styles.outer}>
    <View style={styles.box}>
      <Line label="Subtotal producto" value={totals.productsNet} />
      {discount.amount > 0 && (
        <Line label={discount.label} value={discount.amount} />
      )}
      {shipping.total > 0 && (
        <Line label={shipping.label} value={shipping.total} />
      )}
      <View style={styles.hairline} />
      <Line label="Subtotal" value={totals.subtotal} />
      <Line label="IVA 19%" value={totals.iva} />
      <View style={styles.inkRule} />
      <View style={[styles.line, { marginBottom: 0, alignItems: "baseline" }]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCLP(totals.total)}</Text>
      </View>
    </View>
  </View>
);
