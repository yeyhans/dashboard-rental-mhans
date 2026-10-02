import React from "react";
import { Document, Page } from "@react-pdf/renderer";
import "../../core/fonts";
import type { BudgetDocumentData } from "../../core/types";
import { pdfStyles } from "../../utils/styles";
import { BudgetSheet, PageNumber } from "./BudgetSheet";

/** Budget PDF ("Presupuesto de arriendo"), built 1:1 on the client HTML template. */
export const BudgetDocument: React.FC<{ data: BudgetDocumentData }> = ({
  data,
}) => (
  <Document
    title={`Presupuesto Pedido #${data.orderId}`}
    author="MarioHans FotoRental"
  >
    <Page size="A4" style={pdfStyles.page}>
      <BudgetSheet data={data} />
      <PageNumber />
    </Page>
  </Document>
);
