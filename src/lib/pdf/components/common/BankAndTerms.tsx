import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { BANK_DETAILS, acceptanceTerms } from "../../content/budgetCopy";
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
export const BankAndTerms: React.FC<{ reserveLabel: string }> = ({
  reserveLabel,
}) => (
  <View style={styles.wrapper} wrap={false}>
    <View style={[styles.column, styles.columnGap]}>
      <Text style={styles.heading}>Datos de transferencia</Text>
      <Text style={[styles.body, styles.strong]}>
        {BANK_DETAILS.razonSocial}
      </Text>
      <Text style={styles.body}>RUT {BANK_DETAILS.rut}</Text>
      <Text style={styles.body}>{BANK_DETAILS.banco}</Text>
      <Text style={styles.body}>{BANK_DETAILS.tipoCuenta}</Text>
      <Text style={[styles.body, styles.mono]}>
        {BANK_DETAILS.numeroCuenta}
      </Text>
      <Text style={styles.body}>{BANK_DETAILS.email}</Text>
    </View>
    <View style={styles.column}>
      <Text style={styles.heading}>Aceptación de condiciones</Text>
      <Text style={styles.body}>{acceptanceTerms(reserveLabel)}</Text>
    </View>
  </View>
);
