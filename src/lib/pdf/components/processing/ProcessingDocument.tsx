import React from "react";
import { Document, Page } from "@react-pdf/renderer";
import "../../core/fonts";
import type { ProcessingDocumentData } from "../../core/types";
import {
  ANNEX_TITLE,
  annexIntro,
  annexSections,
} from "../../content/annexCopy";
import { pdfStyles } from "../../utils/styles";
import { BudgetSheet, PageNumber } from "../budget/BudgetSheet";
import { AnnexSection } from "../common/AnnexSection";
import { SignatureLines } from "../common/SignatureLines";

/**
 * Processing PDF (confirmed order): the budget sheet, then the contract annex and the two
 * signature lines. Built on the client HTML template `Presupuesto MarioHans`.
 */
export const ProcessingDocument: React.FC<{ data: ProcessingDocumentData }> = ({
  data,
}) => {
  const facts = { ...data.annex, reserveAmount: data.totals.reserve };
  const { signer, landlord } = data;

  return (
    <Document title={`Pedido #${data.orderId}`} author="MarioHans FotoRental">
      <Page size="A4" style={pdfStyles.page}>
        <BudgetSheet data={data} />
        <AnnexSection
          title={ANNEX_TITLE}
          intro={annexIntro(facts)}
          sections={annexSections(facts)}
        >
          <SignatureLines
            left={{
              name: landlord.name,
              cedula: `Cédula N° ${landlord.cedula}`,
              company: landlord.company,
              companyRut: `RUT N° ${landlord.companyRut}`,
            }}
            {...(landlord.signatureUrl
              ? { images: { left: landlord.signatureUrl } }
              : {})}
            right={{
              name: signer.name,
              cedula: signer.rut ? `Cédula N° ${signer.rut}` : "",
              ...(signer.company ? { company: signer.company } : {}),
              ...(signer.companyRut
                ? { companyRut: `RUT N° ${signer.companyRut}` }
                : {}),
            }}
          />
        </AnnexSection>
        <PageNumber />
      </Page>
    </Document>
  );
};
