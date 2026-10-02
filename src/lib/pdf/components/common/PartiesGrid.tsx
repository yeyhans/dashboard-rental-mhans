import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BudgetClientInfo, BudgetReservationInfo } from "../../core/types";
import { PDF_COLORS, PDF_SIZES, pdfStyles, px } from "../../utils/styles";

const styles = StyleSheet.create({
  grid: { flexDirection: "row", paddingVertical: px(22) },
  column: { flex: 1 },
  columnGap: { marginRight: px(32) },
  heading: { ...pdfStyles.label, marginBottom: px(14) },
  title: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: PDF_SIZES.md,
    lineHeight: 1.3,
    color: PDF_COLORS.ink,
    marginBottom: px(8),
  },
  rows: { flexDirection: "column" },
  row: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.4,
    color: PDF_COLORS.gray600,
    marginBottom: px(5),
  },
  key: { color: PDF_COLORS.gray400 },
  mono: { fontFamily: "IBM Plex Mono", fontWeight: 400 },
});

interface PartiesGridProps {
  client: BudgetClientInfo;
  reservation: BudgetReservationInfo;
}

/** INFORMACIÓN DE CLIENTE | INFORMACIÓN DE RESERVA, two equal columns. */
export const PartiesGrid: React.FC<PartiesGridProps> = ({
  client,
  reservation,
}) => (
  <View style={styles.grid}>
    <View style={[styles.column, styles.columnGap]}>
      <Text style={styles.heading}>Información de cliente</Text>
      <Text style={styles.title}>{client.name}</Text>
      <View style={styles.rows}>
        {!!client.email && <Text style={styles.row}>{client.email}</Text>}
        {!!client.rut && (
          <Text style={styles.row}>
            <Text style={styles.key}>RUT: </Text>
            <Text style={styles.mono}>{client.rut}</Text>
          </Text>
        )}
        {!!client.company && <Text style={styles.row}>{client.company}</Text>}
        {!!client.phone && (
          <Text style={styles.row}>
            <Text style={styles.key}>Tel: </Text>
            <Text style={styles.mono}>{client.phone}</Text>
          </Text>
        )}
      </View>
    </View>
    <View style={styles.column}>
      <Text style={styles.heading}>Información de reserva</Text>
      <Text style={styles.title}>{reservation.title}</Text>
      <View style={styles.rows}>
        <Text style={styles.row}>
          <Text style={styles.key}>Inicio: </Text>
          {reservation.startDate}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.key}>Término: </Text>
          {reservation.endDate}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.key}>Retiro: </Text>
          {reservation.retireLabel}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.key}>Devolución: </Text>
          {reservation.returnDate}
        </Text>
      </View>
    </View>
  </View>
);
