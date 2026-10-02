import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  PDF_COLORS,
  PDF_LAYOUT,
  PDF_SIZES,
  pdfLabelTracking,
  pdfStyles,
  px,
} from "../../utils/styles";
import { formatCLP } from "../../utils/formatters";

export interface ItemsTableRow {
  name: string;
  /** Daily price, CLP. */
  dailyValue: number;
  quantity: number;
  days: number;
  net: number;
  iva: number;
  total: number;
}

/** Column flex weights, as in the template's `2.2fr 1fr .7fr .7fr 1fr 1fr 1fr`. */
const FLEX = [2.2, 1, 0.7, 0.7, 1, 1, 1] as const;
const HEADERS = [
  "Equipo",
  "Valor diario",
  "Cant.",
  "Días",
  "Neto",
  "IVA 19%",
  "Total",
] as const;

const cell = { paddingHorizontal: px(10) };

const styles = StyleSheet.create({
  wrapper: { marginBottom: 0 },
  caption: { ...pdfStyles.label, marginBottom: px(12) },
  head: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.gray50,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
    borderTopLeftRadius: PDF_LAYOUT.radius,
    borderTopRightRadius: PDF_LAYOUT.radius,
    paddingVertical: px(10),
  },
  headCell: {
    ...cell,
    fontFamily: "IBM Plex Mono",
    fontWeight: 500,
    fontSize: PDF_SIZES.xxs,
    letterSpacing: pdfLabelTracking(PDF_SIZES.xxs),
    textTransform: "uppercase",
    color: PDF_COLORS.gray500,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray150,
    paddingVertical: px(10),
    alignItems: "flex-start",
  },
  name: {
    ...cell,
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.4,
    color: PDF_COLORS.ink,
  },
  num: {
    ...cell,
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
    fontSize: PDF_SIZES.xs,
    color: PDF_COLORS.ink,
    textAlign: "right",
  },
});

const columnStyle = (index: number) => ({ flex: FLEX[index]! });

/**
 * EQUIPOS SOLICITADOS table. The header row is `fixed` so it repeats on every page the table
 * flows onto; each body row is `wrap={false}` so a long product name never splits mid-row.
 */
export const ItemsTable: React.FC<{ rows: ItemsTableRow[] }> = ({ rows }) => (
  <View style={styles.wrapper}>
    <Text style={styles.caption}>Equipos solicitados</Text>
    <View fixed style={styles.head}>
      {HEADERS.map((header, index) => (
        <Text
          key={header}
          style={[
            styles.headCell,
            columnStyle(index),
            index === 0 ? { textAlign: "left" } : {},
          ]}
        >
          {header}
        </Text>
      ))}
    </View>
    {rows.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.row} wrap={false}>
        <Text style={[styles.name, columnStyle(0)]}>{row.name}</Text>
        <Text style={[styles.num, columnStyle(1)]}>
          {formatCLP(row.dailyValue)}
        </Text>
        <Text style={[styles.num, columnStyle(2)]}>{row.quantity}</Text>
        <Text style={[styles.num, columnStyle(3)]}>{row.days}</Text>
        <Text style={[styles.num, columnStyle(4)]}>{formatCLP(row.net)}</Text>
        <Text style={[styles.num, columnStyle(5)]}>{formatCLP(row.iva)}</Text>
        <Text style={[styles.num, columnStyle(6)]}>{formatCLP(row.total)}</Text>
      </View>
    ))}
  </View>
);
