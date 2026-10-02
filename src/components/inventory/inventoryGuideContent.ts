import { formatAssetTag } from "../../lib/assetTag";
import { LABEL_MM } from "../../lib/labelGeometry";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABELS,
  type AssetCondition,
} from "../../types/inventory";
import { MAX_LABELS_PER_SHEET } from "./labelSheet";

/**
 * Content of the in-app equipment guide, as data so the structure is testable and the numbers it
 * quotes (tag format, label size, sheet cap, conditions) come from the same constants the app uses.
 * Every statement was checked against the code; do not add a claim the code does not back.
 */

export const GUIDE_ASSET_TAG_EXAMPLE = formatAssetTag(1);
export const GUIDE_LABEL_SIZE = `${LABEL_MM.width} x ${LABEL_MM.height} mm`;

export interface GuideVocabularyRow {
  term: string;
  what: string;
  who: string;
}

export const GUIDE_VOCABULARY: readonly GuideVocabularyRow[] = [
  {
    term: "Producto / SKU",
    what: "Un modelo del catálogo. El SKU es el código del modelo y lo comparten todas sus unidades.",
    who: "El administrador, en Productos.",
  },
  {
    term: "Unidad (asset tag)",
    what: `Una pieza física concreta. Se identifica con el asset tag, formato MH-00000 (por ejemplo ${GUIDE_ASSET_TAG_EXAMPLE}). Es único por unidad y nunca se reutiliza.`,
    who: "Se imprime en la etiqueta y se asigna al registrar la unidad en Inventario.",
  },
  {
    term: "Número de serie",
    what: "El serial que el fabricante grabó en el equipo. No puede repetirse entre unidades (da igual mayúsculas o minúsculas).",
    who: "Quien registra la unidad lo escribe una sola vez.",
  },
  {
    term: "QR",
    what: "Código cuadrado de la etiqueta. Contiene el asset tag, no el número de serie. Se lee con la cámara del teléfono.",
    who: "Se genera solo al crear las etiquetas.",
  },
  {
    term: "Código de barras (Code 128)",
    what: "Código de barras de la etiqueta. Contiene el mismo asset tag que el QR. Lo lee una pistola lectora.",
    who: "Se genera solo al crear las etiquetas.",
  },
  {
    term: "Etiqueta",
    what: `Sticker con el QR, el Code 128 y el asset tag. Tamaño ${GUIDE_LABEL_SIZE}, para impresora Brother QL (rollo DK-11209).`,
    who: "El administrador la imprime en Inventario > Etiquetas y se pega en cada equipo.",
  },
  {
    term: "Kit",
    what: "Código opcional que agrupa unidades que viajan juntas. La mayoría de las unidades no tiene kit.",
    who: "Quien registra la unidad, si corresponde.",
  },
  {
    term: "Ubicación",
    what: "Dónde se guarda la unidad (estante, caja, bodega). Es obligatoria al registrar.",
    who: "Quien registra la unidad.",
  },
  {
    term: "Condición",
    what: "Estado físico de la unidad. No indica si está arrendada.",
    who: "Quien registra la unidad.",
  },
];

export interface GuideCondition {
  value: AssetCondition;
  label: string;
}

export const GUIDE_CONDITIONS: readonly GuideCondition[] = ASSET_CONDITIONS.map(
  (value) => ({
    value,
    label: ASSET_CONDITION_LABELS[value],
  }),
);

export interface GuideStepGroup {
  heading?: string;
  steps: readonly string[];
}

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  /** Renders the vocabulary table (section 1 only). */
  table?: "vocabulary";
  /** Always at least one group; a section without sub-headings has a single headless group. */
  groups: readonly GuideStepGroup[];
  note?: string;
}

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "vocabulary",
    title: "Vocabulario",
    intro: "Estas palabras se usan en todo el sistema.",
    table: "vocabulary",
    groups: [],
    note: `Condiciones posibles: ${GUIDE_CONDITIONS.map((entry) => entry.label).join(", ")}.`,
  },
  {
    id: "product-link",
    title: "Cómo se conectan Productos e Inventario",
    groups: [
      {
        steps: [
          "Productos guarda modelos. Una fila de Productos es un modelo, con su SKU.",
          "Inventario guarda unidades físicas. Cada unidad apunta a su producto (product_id).",
          "El SKU es compartido: cuatro unidades del mismo modelo tienen el mismo SKU.",
          "El asset tag es único: distingue una unidad de otra aunque sean del mismo modelo.",
          "El sistema usa el asset tag, no el SKU, para saber qué pieza salió o volvió.",
          "Un producto no se puede borrar mientras tenga unidades registradas.",
        ],
      },
    ],
  },
  {
    id: "configure-stock",
    title: "Configurar el stock de un producto",
    groups: [
      {
        steps: [
          "En Productos, crea el equipo con Nuevo Equipo, o confirma que ya existe y tiene su SKU.",
          `En Inventario, toca Etiquetas, indica desde qué asset tag y cuántas (máximo ${MAX_LABELS_PER_SHEET} por hoja) e imprime antes de empezar.`,
          "Pega una etiqueta en cada unidad física.",
          "En el formulario de Inventario, elige el producto, escanea o escribe el asset tag de la etiqueta y escribe el número de serie del fabricante.",
          "Indica la condición y la ubicación. El kit es opcional. Guarda.",
          "Repite con la siguiente unidad: producto, condición, ubicación y kit se mantienen; asset tag y serie quedan en blanco.",
          "Revisa el Avance del inventario: cuenta los productos publicados que ya tienen al menos una unidad.",
          "Abre Calidad de datos: lista los productos con campos vacíos (SKU, marca, tipo, estado, stock) o cuya cantidad contada no coincide con la declarada. Corrígelos hasta vaciar la lista.",
        ],
      },
    ],
    note: "Si una etiqueta se rompe, usa Imprimir etiqueta en la tabla de equipos registrados en esta sesión.",
  },
  {
    id: "labels",
    title: "Crear e imprimir etiquetas",
    groups: [
      {
        steps: [
          "Entra a Inventario y toca el botón Etiquetas (arriba a la derecha).",
          "Rollo nuevo: escribe el asset tag inicial (la página sugiere el siguiente libre) y la cantidad, y toca Generar etiquetas.",
          "Reimpresión: en la tabla de equipos registrados, toca Imprimir etiqueta en la fila de la unidad.",
          `Cada etiqueta lleva el asset tag en QR y en Code 128, tamaño ${GUIDE_LABEL_SIZE}.`,
          "Las etiquetas de un rollo nuevo no llevan el nombre del modelo; las reimpresiones sí.",
          "Imprime desde el navegador con la impresora Brother QL cargada con el rollo DK-11209.",
        ],
      },
    ],
  },
  {
    id: "operator",
    title: "Operador en el teléfono (Bodega)",
    intro:
      "Bodega está pensada para el teléfono. Funciona con la pistola lectora, con la cámara o escribiendo el asset tag.",
    groups: [
      {
        heading: "Retiro: equipos que salen",
        steps: [
          "Abre Bodega. En Retiros verás las órdenes de hoy y mañana.",
          "Toca la orden. Arriba está el avance total (por ejemplo 0/6) y abajo cada producto con su avance.",
          "Deja marcado Salida.",
          "Escanea el asset tag de cada equipo, o escríbelo y presiona Enter. El botón de cámara aparece solo si el navegador la soporta.",
          "Si el registro sale bien, la unidad suma al avance. Si no, el mensaje de error dice por qué: la unidad no existe, no es de esta orden, la línea ya está completa o ya tiene una salida abierta.",
          "Termina cuando todas las líneas estén completas.",
        ],
      },
      {
        heading: "Devolución: equipos que vuelven",
        steps: [
          "En Bodega, abre la orden desde Devoluciones. Las atrasadas llevan la marca Atrasada.",
          "Cambia a Entrada.",
          "Escanea cada unidad que regresa. Solo se acepta la entrada de una unidad que tenga una salida abierta.",
        ],
      },
      {
        heading: "Si una unidad está dañada o falta",
        steps: [
          "Hoy el escáner no tiene campo para marcar daños: no registra condición ni observaciones.",
          "Unidad dañada: escanéala igual para que quede registrado que volvió, y avisa de inmediato al administrador para que la revise.",
          "Unidad que no aparece: no la escanees. La línea queda incompleta y la orden sigue en Devoluciones, con la marca Atrasada si ya pasó la fecha.",
          "Si la etiqueta no se lee, escribe el asset tag a mano. Si la unidad no tiene etiqueta o no existe en Inventario, avisa al administrador.",
        ],
      },
      {
        heading: "Qué ve el administrador",
        steps: [
          "En Inventario > Movimientos aparece cada salida y entrada escaneada, en vivo, con filtros.",
          "Resume las unidades afuera ahora, las atrasadas y los movimientos de hoy.",
        ],
      },
    ],
  },
  {
    id: "checklist",
    title: "Antes de aprobar órdenes",
    intro:
      "Para que el operador pueda validar una orden con el escáner, revisa esto por cada producto de la orden:",
    groups: [
      {
        steps: [
          "El producto existe en Productos y tiene SKU.",
          "Tiene registradas en Inventario al menos tantas unidades como pide la orden.",
          "Cada unidad tiene su etiqueta pegada y legible, y coincide con el asset tag registrado.",
          "Las unidades que irán en la orden están en condición Operativo (el escáner no lo exige, pero conviene).",
          "El operador tiene su cuenta con acceso a Bodega.",
          "La orden aparece en Retiros (la fecha de retiro es hoy o mañana).",
        ],
      },
    ],
    note: "El escáner solo acepta unidades de los productos de la orden y no deja pasar más unidades que la cantidad pedida.",
  },
];
