import type { ProcessingAnnexInfo } from "../core/types";
import { formatCLP } from "../utils/formatters";

/** Annex of the processing PDF, verbatim from the client HTML template ("Anexo de contrato"). */

export const ANNEX_TITLE = "Anexo de contrato";

export const PICKUP_ADDRESS = "Purísima 25 o Bellavista 77, Recoleta";

export const LANDLORD = {
  name: "Mario Alberto Hans Salinas",
  cedula: "16.135.586-0",
  company: "Hans Salinas SpA",
  rut: "77.892.569-9",
} as const;

export const REPRESENTATION_LABEL = "En representación de";

export interface AnnexSectionCopy {
  /** Small mono label shown above the title ("Obligaciones de las partes"). */
  parent?: string;
  title: string;
  paragraphs: string[];
}

export interface AnnexFacts extends ProcessingAnnexInfo {
  /** Reserve amount in CLP (gross), used when the reserve is not a percentage. */
  reserveAmount: number;
}

function pct(value: number): string {
  return String(value).replace(".", ",");
}

export function annexIntro(facts: AnnexFacts): string[] {
  const reserve =
    facts.reservePct !== undefined
      ? `La reserva por el arriendo de los bienes corresponde al ${pct(facts.reservePct)}% del valor total del arriendo.`
      : `La reserva por el arriendo de los bienes corresponde a ${formatCLP(facts.reserveAmount)} del valor total del arriendo.`;
  return [
    `El presente Contrato comenzará a regir con fecha ${facts.startDate} y finalizará el ${facts.endDate}, salvo las partes acuerden su extensión, lo que debe constar en Anexo del presente Contrato.`,
    `El (los) bien(es) mueble(s) objeto del presente Contrato deberán ser entregados por el ARRENDADOR el día ${facts.deliveryDate} en ${facts.pickupAddress}.`,
    "Salvo las partes expresamente acuerden otra cosa, la devolución de los equipos se debe realizar como máximo a las 13:00 hrs del día siguiente de finalizada la jornada de arriendo, previo aviso para coordinar la hora de recepción y revisión de los equipos arrendados.",
    `Valor total del arriendo ${formatCLP(facts.totalNet)} + IVA.`,
    reserve,
  ];
}

export function annexSections(facts: AnnexFacts): AnnexSectionCopy[] {
  const hasPct = facts.reservePct !== undefined;
  const reserveParagraph = hasPct
    ? `Se debe pagar una reserva del ${pct(facts.reservePct!)}% al confirmar el arriendo.`
    : `Se debe pagar una reserva de ${formatCLP(facts.reserveAmount)} al confirmar el arriendo.`;
  const balanceParagraph = hasPct
    ? `El saldo restante, correspondiente al ${pct(Math.round((100 - facts.reservePct!) * 100) / 100)}% del valor total del arriendo, deberá ser pagado en su totalidad antes o en el momento de la devolución por parte de la ARRENDATARIA de los bienes arrendados.`
    : "El saldo restante del valor total del arriendo deberá ser pagado en su totalidad antes o en el momento de la devolución por parte de la ARRENDATARIA de los bienes arrendados.";

  return [
    {
      title: "Uso del equipo",
      paragraphs: [
        "Los equipos solo pueden ser usados para actividades de fotografía y producción audiovisual.",
        "No se permite subarrendar, modificar ni ceder los equipos sin autorización del arrendador.",
        "El incumplimiento de estas condiciones puede dar lugar a la terminación del contrato.",
      ],
    },
    {
      title: "Devolución de equipos",
      paragraphs: [
        "La devolución se realiza en la dirección del arrendador, según lo estipulado en el Anexo.",
        "Los equipos deben ser devueltos en el mismo estado en que fueron entregados, limpios y secos.",
      ],
    },
    {
      title: "Multa por retraso",
      paragraphs: [
        "En caso de incumplimiento de devolución en la fecha acordada, se aplicará una multa equivalente al valor de un día de arriendo por cada día de retraso en la devolución de los bienes.",
      ],
    },
    {
      title: "Pago y reserva",
      paragraphs: [
        reserveParagraph,
        balanceParagraph,
        "Si el arrendatario cancela con menos de 48 horas de anticipación, no se reembolsa la reserva.",
        "Pagos mediante transferencia bancaria u otros métodos disponibles en la plataforma.",
      ],
    },
    {
      title: "Responsabilidad por daños y reparaciones",
      paragraphs: [
        "El arrendatario es responsable de los equipos desde su retiro hasta su devolución.",
        "En caso de daños, debe pagar la reparación en un servicio técnico autorizado o reponer el equipo.",
        "Si hay destrucción total o pérdida del equipo, el arrendatario debe pagar su valor total.",
        "Si los equipos se devuelven sucios o húmedos, el arrendador puede cobrar costos de limpieza y reparación.",
        "Plazo para reparación o reposición: máximo 10 días hábiles.",
      ],
    },
    {
      parent: "Obligaciones de las partes",
      title: "Arrendador",
      paragraphs: [
        "Entregar los equipos en óptimas condiciones.",
        "Mantener los equipos en estado operativo antes del arriendo.",
      ],
    },
    {
      parent: "Obligaciones de las partes",
      title: "Arrendatario",
      paragraphs: [
        "Revisar los equipos al momento de la entrega.",
        "Usarlos exclusivamente para los fines declarados.",
        "No modificar ni realizar mejoras sin autorización.",
        "Asumir responsabilidad por daños o pérdidas.",
        "Notificar de inmediato cualquier daño o pérdida.",
      ],
    },
    {
      title: "Resolución del contrato",
      paragraphs: [
        "Puede terminarse por mutuo acuerdo o por incumplimiento de alguna de las partes.",
        "Si el arrendador detecta una infracción grave, puede cancelar el contrato y eliminar la cuenta del usuario en la plataforma.",
        "La resolución no exime al arrendatario de sus obligaciones pendientes.",
      ],
    },
    {
      title: "Legislación aplicable y notificaciones",
      paragraphs: [
        "El contrato se rige por la legislación chilena y los tribunales de Santiago.",
      ],
    },
  ];
}
