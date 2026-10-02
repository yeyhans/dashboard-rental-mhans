import React from "react";
import { Text, View } from "@react-pdf/renderer";
import "../../core/fonts";
import type { BudgetDocumentData } from "../../core/types";
import { DOCUMENT_LABEL } from "../../content/budgetCopy";
import { orderBreakdown } from "../../../orderBreakdown";
import { PDF_COLORS } from "../../utils/styles";
import { DocHeader } from "../common/DocHeader";
import { PartiesGrid } from "../common/PartiesGrid";
import { NoteBox } from "../common/NoteBox";
import { ItemsTable, type ItemsTableRow } from "../common/ItemsTable";
import { TotalsBlock } from "../common/TotalsBlock";
import { ReserveBox } from "../common/ReserveBox";
import { BankAndTerms } from "../common/BankAndTerms";
import { FooterPolicy } from "../common/FooterPolicy";

/**
 * Everything the budget sheet prints inside a page, shared by the budget and the processing
 * documents. The net / IVA / gross columns come from the canonical `orderBreakdown`, so they
 * reconcile with the stored `calculated_*` totals printed below.
 */
export const BudgetSheet: React.FC<{ data: BudgetDocumentData }> = ({
  data,
}) => {
  const breakdown = orderBreakdown({
    lineItems: data.lineItems,
    jornadas: data.numJornadas,
    discount: data.discount.amount,
    shippingTotal: data.shipping.total,
    calculatedSubtotal: data.totals.subtotal,
    calculatedIva: data.totals.iva,
  });

  const rows: ItemsTableRow[] = data.lineItems.map((item, index) => ({
    name: item.name,
    dailyValue: item.price,
    quantity: item.quantity,
    days: data.numJornadas,
    net: breakdown.lines[index]?.net ?? 0,
    iva: breakdown.lines[index]?.iva ?? 0,
    total: breakdown.lines[index]?.gross ?? 0,
  }));

  return (
    <>
      <DocHeader
        label={DOCUMENT_LABEL}
        title={`Pedido #${data.orderId}`}
        dateLine={`Fecha: ${data.issueDate}`}
      />
      <PartiesGrid client={data.client} reservation={data.reservation} />
      <NoteBox note={data.note} />
      <ItemsTable rows={rows} />
      {/* Each block keeps itself whole, but they may land on different pages: wrapping
          totals + reserve together pushed both to a new page and left a large gap. */}
      <View wrap={false}>
        <TotalsBlock
          totals={data.totals}
          discount={data.discount}
          shipping={data.shipping}
        />
      </View>
      <View wrap={false}>
        <ReserveBox
          reserveLabel={data.totals.reserveLabel}
          reserve={data.totals.reserve}
          balance={data.totals.balance}
        />
      </View>
      <BankAndTerms reserveLabel={data.totals.reserveLabel} />
      <FooterPolicy />
    </>
  );
};

/** Fixed "Página X de Y" footer shared by the budget-based documents. */
export const PageNumber: React.FC = () => (
  <Text
    fixed
    style={{
      position: "absolute",
      bottom: 20,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: "IBM Plex Mono",
      fontSize: 7,
      color: PDF_COLORS.gray400,
    }}
    render={({ pageNumber, totalPages }) =>
      `Página ${pageNumber} de ${totalPages}`
    }
  />
);
