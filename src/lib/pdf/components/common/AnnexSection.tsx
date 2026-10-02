import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { AnnexSectionCopy } from "../../content/annexCopy";
import {
  PDF_COLORS,
  PDF_LAYOUT,
  PDF_SIZES,
  pdfLabelTracking,
  px,
} from "../../utils/styles";

const styles = StyleSheet.create({
  /** Full-bleed gray band: cancels the page side margins and restores them as padding. */
  band: {
    marginTop: px(32),
    marginHorizontal: -PDF_LAYOUT.pageMarginX,
    paddingHorizontal: PDF_LAYOUT.pageMarginX,
    paddingTop: px(32),
    paddingBottom: px(40),
    backgroundColor: PDF_COLORS.gray50,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gray150,
  },
  heading: {
    fontFamily: "Archivo",
    fontWeight: 800,
    fontSize: PDF_SIZES.xl,
    lineHeight: 1.2,
    color: PDF_COLORS.ink,
    marginBottom: px(20),
  },
  intro: { marginBottom: px(24) },
  body: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.65,
    color: PDF_COLORS.gray600,
  },
  section: { marginBottom: px(22) },
  parent: {
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    fontSize: PDF_SIZES.xxs,
    lineHeight: 1,
    letterSpacing: pdfLabelTracking(PDF_SIZES.xxs),
    color: PDF_COLORS.gray400,
    marginBottom: px(7),
  },
  title: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: PDF_SIZES.sm,
    lineHeight: 1.3,
    color: PDF_COLORS.ink,
    marginBottom: px(8),
  },
});

const Paragraph: React.FC<{ text: string; gap: boolean; gapSize?: number }> = ({
  text,
  gap,
  gapSize = 6,
}) => (
  <Text style={[styles.body, gap ? { marginBottom: px(gapSize) } : {}]}>
    {text}
  </Text>
);

interface AnnexSectionProps {
  title: string;
  intro: string[];
  sections: AnnexSectionCopy[];
  /** Rendered at the end of the band (signature block). */
  children?: React.ReactNode;
}

/**
 * "Anexo de contrato": gray band with the intro, the titled clauses and, as children, the
 * signature block. Clauses flow across pages; each title stays with its first paragraph.
 */
export const AnnexSection: React.FC<AnnexSectionProps> = ({
  title,
  intro,
  sections,
  children,
}) => (
  <View style={styles.band}>
    <View style={styles.intro}>
      <View wrap={false}>
        <Text style={styles.heading}>{title}</Text>
        <Paragraph text={intro[0] ?? ""} gap={intro.length > 1} gapSize={10} />
      </View>
      {intro.slice(1).map((paragraph, index, rest) => (
        <Paragraph
          key={index}
          text={paragraph}
          gap={index < rest.length - 1}
          gapSize={10}
        />
      ))}
    </View>
    {sections.map((section, index) => (
      <View key={index} style={styles.section}>
        {/* Title group + first paragraph never split, so a title is never left orphaned. */}
        <View wrap={false}>
          {section.parent ? (
            <Text style={styles.parent}>{section.parent.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.title}>{section.title}</Text>
          <Paragraph
            text={section.paragraphs[0] ?? ""}
            gap={section.paragraphs.length > 1}
          />
        </View>
        {section.paragraphs.slice(1).map((paragraph, pIndex, rest) => (
          <Paragraph
            key={pIndex}
            text={paragraph}
            gap={pIndex < rest.length - 1}
          />
        ))}
      </View>
    ))}
    {children}
  </View>
);
