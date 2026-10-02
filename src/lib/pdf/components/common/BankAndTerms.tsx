import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfBankInfo } from "../../core/types";
import { acceptanceTerms } from "../../content/budgetCopy";
import { PDF_COLORS, PDF_SIZES, pdfStyles, px } from "../../utils/styles";

const styles = StyleSheet.create({
  wrapper: {
    marginTop: px(18),
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gray150,
    paddingTop: px(18),
    flexDirection: "row",
  },
  column: { flex: 1 },
  columnGap: { marginRight: px(32) },
  heading: { ...pdfStyles.label, marginBottom: px(10) },
  body: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.xs,
    lineHeight: 1.5,
    color: PDF_COLORS.gray600,
  },
  strong: { fontWeight: 600, color: PDF_COLORS.ink },
  mono: { fontFamily: "IBM Plex Mono", fontWeight: 400 },
});

/** DATOS DE TRANSFERENCIA | ACEPTACIÓN DE CONDICIONES. */
export const BankAndTerms: React.FC<{
  bank: PdfBankInfo;
  /** Acceptance template with the `{reserva}` placeholder. */
  acceptance: string;
  reserveLabel: string;
}> = ({ bank, acceptance, reserveLabel }) => (
  <View style={styles.wrapper} wrap={false}>
    <View style={[styles.column, styles.columnGap]}>
      <Text style={styles.heading}>Datos de transferencia</Text>
      {bank.holder ? (
        <Text style={[styles.body, styles.strong]}>{bank.holder}</Text>
      ) : null}
      {bank.rut ? <Text style={styles.body}>RUT {bank.rut}</Text> : null}
      {bank.bankName ? <Text style={styles.body}>{bank.bankName}</Text> : null}
      {bank.accountType ? (
        <Text style={styles.body}>{bank.accountType}</Text>
      ) : null}
      {bank.accountNumber ? (
        <Text style={[styles.body, styles.mono]}>{bank.accountNumber}</Text>
      ) : null}
      {bank.email ? <Text style={styles.body}>{bank.email}</Text> : null}
    </View>
    <View style={styles.column}>
      <Text style={styles.heading}>Aceptación de condiciones</Text>
      <Text style={styles.body}>
        {acceptanceTerms(acceptance, reserveLabel)}
      </Text>
    </View>
  </View>
);
