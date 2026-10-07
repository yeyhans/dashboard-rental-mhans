/**
 * Clientes & Documentos — validation and financial state.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Clientes_Documentos_Canonical_RC2.1.2.html`,
 * which filters clients by "Estado del cliente" (Validados / Pendientes / Incompletos / Con deuda)
 * and by "Estado financiero" (Al día / Pago pendiente / Con deuda).
 *
 * The canonical names the buckets but not their rule. The rule comes from the operational
 * requirement in `.claude/rules/01-business-context.md` — "sin contrato NO hay retiro" — plus the
 * document set the contract flow actually collects: RUT front and back, signature, and the
 * company E-RUT when the client is a company.
 *
 * This is the difference the module exists to show: a client who cannot pick up gear tomorrow
 * because a document is missing, spotted before the pickup rather than at the counter.
 */

/** The three validation buckets of the canonical. */
export type ClientValidation = "validado" | "pendiente" | "incompleto";

export type ClientFinancial = "al-dia" | "pago-pendiente" | "con-deuda";

export const VALIDATION_LABELS: Record<ClientValidation, string> = {
  validado: "Validado",
  pendiente: "Pendiente",
  incompleto: "Incompleto",
};

export const FINANCIAL_LABELS: Record<ClientFinancial, string> = {
  "al-dia": "Al día",
  "pago-pendiente": "Pago pendiente",
  "con-deuda": "Con deuda",
};

export interface ClientProfileLike {
  readonly tipoCliente: string | null;
  readonly contractUrl: string | null;
  readonly rutFrontUrl: string | null;
  readonly rutBackUrl: string | null;
  readonly signatureUrl: string | null;
  /** Company E-RUT. Only required when `tipoCliente === 'empresa'`. */
  readonly companyErutUrl: string | null;
  readonly termsAccepted: boolean;
}

/**
 * The documents this client must supply, which depend on the client type.
 *
 * Required: ID card front and back, the signed contract, and the company E-RUT for companies.
 * The signature image (`signatureUrl`) is NOT a separate requirement: it is embedded in the signed
 * contract, so asking for both would count one fact twice.
 *
 * A natural person is never asked for a company E-RUT: demanding it would leave every individual
 * permanently "incompleto" and make the filter useless.
 */
export function requiredDocuments(
  profile: ClientProfileLike,
): Array<keyof ClientProfileLike> {
  const base: Array<keyof ClientProfileLike> = [
    "rutFrontUrl",
    "rutBackUrl",
    "contractUrl",
  ];
  return profile.tipoCliente === "empresa" ? [...base, "companyErutUrl"] : base;
}

/** Documents still missing, in the order the contract flow asks for them. */
export function missingDocuments(
  profile: ClientProfileLike,
): Array<keyof ClientProfileLike> {
  return requiredDocuments(profile).filter((field) => !profile[field]);
}

/** Every requirement a client must meet to be `validado`. */
export type ClientRequirementKey =
  | "terms"
  | "contract"
  | "idFront"
  | "idBack"
  | "erut";

export const REQUIREMENT_LABELS: Record<ClientRequirementKey, string> = {
  terms: "Términos aceptados",
  contract: "Contrato firmado",
  idFront: "Carnet frontal",
  idBack: "Carnet reverso",
  erut: "E-RUT (empresa)",
};

export interface ClientRequirement {
  readonly key: ClientRequirementKey;
  readonly label: string;
  readonly met: boolean;
}

export interface ClientValidationReport {
  readonly status: ClientValidation;
  /** Applicable requirements (E-RUT only for companies), each with its state. */
  readonly requirements: ClientRequirement[];
  /** The unmet subset of `requirements`, same order. */
  readonly missing: ClientRequirement[];
}

/**
 * Validation matrix (decision 2026-10-07):
 *
 *   validado   terms accepted AND signed contract AND ID front+back (AND E-RUT if empresa)
 *   pendiente  identity documents are in (ID front+back, E-RUT if empresa) but the contract and/or
 *              the terms are missing — the client can still finish the flow on their own
 *   incompleto an identity document (ID front/back, company E-RUT) is missing — nothing can be
 *              signed or verified until it arrives
 *
 * Requirements are listed in the order the contract flow asks for them.
 */
export function clientValidationReport(
  profile: ClientProfileLike,
): ClientValidationReport {
  const spec: Array<[ClientRequirementKey, boolean]> = [
    ["terms", profile.termsAccepted],
    ["contract", Boolean(profile.contractUrl)],
    ["idFront", Boolean(profile.rutFrontUrl)],
    ["idBack", Boolean(profile.rutBackUrl)],
  ];
  if (profile.tipoCliente === "empresa")
    spec.push(["erut", Boolean(profile.companyErutUrl)]);

  const requirements = spec.map(([key, met]) => ({
    key,
    label: REQUIREMENT_LABELS[key],
    met,
  }));
  const missing = requirements.filter((r) => !r.met);

  const identityMissing = missing.some(
    (r) => r.key !== "terms" && r.key !== "contract",
  );
  const status: ClientValidation =
    missing.length === 0
      ? "validado"
      : identityMissing
        ? "incompleto"
        : "pendiente";

  return { status, requirements, missing };
}

/** The validation bucket. See {@link clientValidationReport} for the matrix. */
export function clientValidation(profile: ClientProfileLike): ClientValidation {
  return clientValidationReport(profile).status;
}

/** Whether this client can legally pick up equipment. */
export function canPickUp(profile: ClientProfileLike): boolean {
  return clientValidation(profile) === "validado";
}

export interface ClientBalanceLike {
  /** Money owed across all of the client's open orders. */
  readonly outstanding: number;
  /** Whether any of those orders is past its payment date. */
  readonly hasOverdue: boolean;
}

/**
 * The financial bucket.
 *
 * `con-deuda` is reserved for overdue money. A balance that is simply not due yet is
 * `pago-pendiente`: collapsing the two would put every ongoing rental in the debtors list and
 * make the one filter that matters unusable.
 */
export function clientFinancial(balance: ClientBalanceLike): ClientFinancial {
  if (balance.hasOverdue) return "con-deuda";
  return balance.outstanding > 0 ? "pago-pendiente" : "al-dia";
}

export interface ClientKpis {
  total: number;
  validados: number;
  pendientes: number;
  incompletos: number;
  conDeuda: number;
}

export function clientKpis(
  clients: ReadonlyArray<{
    profile: ClientProfileLike;
    balance: ClientBalanceLike;
  }>,
): ClientKpis {
  const kpis: ClientKpis = {
    total: clients.length,
    validados: 0,
    pendientes: 0,
    incompletos: 0,
    conDeuda: 0,
  };

  for (const { profile, balance } of clients) {
    const validation = clientValidation(profile);
    if (validation === "validado") kpis.validados++;
    else if (validation === "pendiente") kpis.pendientes++;
    else kpis.incompletos++;

    if (clientFinancial(balance) === "con-deuda") kpis.conDeuda++;
  }

  return kpis;
}
