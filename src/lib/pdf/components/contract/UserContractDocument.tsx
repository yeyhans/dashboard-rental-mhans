import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import "../../core/fonts";
import { getLogoSource } from "../../core/fonts";
import type { UserContractDocumentData } from "../../core/types";
import {
  buildContractCopy,
  type ContractClause,
} from "../../content/contractCopy";
import { PDF_COLORS } from "../../utils/styles";
import { PageNumber } from "../budget/BudgetSheet";
import { SignatureLines } from "../common/SignatureLines";

// The contract HTML is drawn at CSS scale (1 px = 0.75 pt) on an A4 page with 0.9 in margins.
const pt = (value: number): number => Math.round(value * 0.75 * 10) / 10;
const PAGE_MARGIN = 64.8;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    backgroundColor: PDF_COLORS.white,
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN,
    paddingHorizontal: PAGE_MARGIN,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: pt(10),
    marginBottom: pt(22),
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray150,
    borderBottomStyle: "solid",
  },
  logo: { height: 15, width: 15 * (2168 / 375), objectFit: "contain" },
  headerText: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 400,
    fontSize: pt(10),
    letterSpacing: pt(10) * 0.06,
    textTransform: "uppercase",
    color: PDF_COLORS.gray400,
  },
  h1: {
    fontFamily: "Archivo",
    fontWeight: 800,
    fontSize: pt(28),
    lineHeight: 1.2,
    letterSpacing: -pt(28) * 0.01,
    color: PDF_COLORS.ink,
    marginBottom: pt(24),
  },
  h2: {
    fontFamily: "Archivo",
    fontWeight: 700,
    fontSize: pt(17),
    letterSpacing: pt(17) * 0.03,
    textTransform: "uppercase",
    color: PDF_COLORS.ink,
    marginTop: pt(36),
    marginBottom: pt(12),
    paddingTop: pt(14),
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gray200,
    borderTopStyle: "solid",
  },
  p: {
    fontSize: pt(15),
    lineHeight: 1.65,
    color: PDF_COLORS.inkSoft,
    marginBottom: pt(14),
  },
  bullets: { marginBottom: pt(14), paddingLeft: pt(22) - 8 },
  bullet: { flexDirection: "row", marginBottom: pt(8) },
  bulletMark: {
    width: 14,
    fontSize: pt(15),
    lineHeight: 1.65,
    color: PDF_COLORS.inkSoft,
  },
  bulletText: {
    flex: 1,
    fontSize: pt(15),
    lineHeight: 1.65,
    color: PDF_COLORS.inkSoft,
  },
});

const ContractHeader: React.FC<{ subtitle: string; companyLine: string }> = ({
  subtitle,
  companyLine,
}) => (
  <View fixed style={styles.header}>
    <Image src={getLogoSource()} style={styles.logo} />
    <Text style={styles.headerText}>{companyLine}</Text>
    <Text
      style={styles.headerText}
    >{`Contrato de arriendo — ${subtitle}`}</Text>
  </View>
);

const Paragraph: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.p}>{children}</Text>
);

const Heading: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.h2} minPresenceAhead={60}>
    {children}
  </Text>
);

const ClauseView: React.FC<{ clause: ContractClause }> = ({ clause }) => {
  const [first, ...rest] = clause.blocks;
  const renderBlock = (block: (typeof clause.blocks)[number], key: number) =>
    block.kind === "p" ? (
      <Paragraph key={key}>{block.text}</Paragraph>
    ) : (
      <View key={key} style={styles.bullets}>
        {block.items.map((item, i) => (
          <View key={i} style={styles.bullet} wrap={false}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  return (
    <>
      {/* Heading + first block stay together so a heading never sits alone at a page bottom. */}
      <View wrap={false}>
        <Heading>{`${clause.number}: ${clause.title}`}</Heading>
        {first ? renderBlock(first, 0) : null}
      </View>
      {rest.map((block, i) => renderBlock(block, i + 1))}
    </>
  );
};

/** Client contract PDF, built on the client HTML `Contrato Arrendamiento`. */
export const UserContractDocument: React.FC<{
  data: UserContractDocumentData;
}> = ({ data }) => {
  const copy = buildContractCopy(data);
  const { signer, landlord } = data;

  return (
    <Document title="Contrato de arriendo" author="MarioHans FotoRental">
      <Page size="A4" style={styles.page}>
        <ContractHeader
          subtitle={data.subtitle}
          companyLine={`${data.landlord.company} · FotoRental`}
        />
        <Text style={styles.h1}>{copy.title}</Text>
        <Paragraph>{copy.comparecencia}</Paragraph>
        <Paragraph>{copy.preamble}</Paragraph>
        <Heading>{copy.exponenTitle}</Heading>
        {copy.exponen.map((text, i) => (
          <Paragraph key={i}>{text}</Paragraph>
        ))}
        <Heading>{copy.clausesTitle}</Heading>
        {copy.clauses.map((clause, index) =>
          index < copy.clauses.length - 1 ? (
            <ClauseView key={clause.number} clause={clause} />
          ) : (
            /* The last clause travels with the signatures: no page holding only signature lines. */
            <View key={clause.number} wrap={false}>
              <ClauseView clause={clause} />
              <SignatureLines
                left={{
                  name: landlord.name,
                  cedula: `Cédula de identidad nacional N° ${landlord.cedula}`,
                  company: landlord.company,
                  companyRut: `RUT N° ${landlord.companyRut}`,
                }}
                right={{
                  name: signer.name,
                  cedula: signer.cedula,
                  ...(signer.company ? { company: signer.company } : {}),
                  ...(signer.companyRut
                    ? { companyRut: signer.companyRut }
                    : {}),
                }}
                images={{
                  ...(landlord.signatureUrl
                    ? { left: landlord.signatureUrl }
                    : {}),
                  ...(data.signatureImageUrl
                    ? { right: data.signatureImageUrl }
                    : {}),
                }}
              />
            </View>
          ),
        )}
        <PageNumber />
      </Page>
    </Document>
  );
};
