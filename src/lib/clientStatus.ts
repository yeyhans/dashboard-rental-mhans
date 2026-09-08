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
export type ClientValidation = 'validado' | 'pendiente' | 'incompleto';

export type ClientFinancial = 'al-dia' | 'pago-pendiente' | 'con-deuda';

export const VALIDATION_LABELS: Record<ClientValidation, string> = {
  validado: 'Validado',
  pendiente: 'Pendiente',
  incompleto: 'Incompleto',
};

export const FINANCIAL_LABELS: Record<ClientFinancial, string> = {
  'al-dia': 'Al día',
  'pago-pendiente': 'Pago pendiente',
  'con-deuda': 'Con deuda',
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
 * A natural person is never asked for a company E-RUT: demanding it would leave every individual
 * permanently "incompleto" and make the filter useless.
 */
export function requiredDocuments(profile: ClientProfileLike): Array<keyof ClientProfileLike> {
  const base: Array<keyof ClientProfileLike> = [
    'rutFrontUrl',
    'rutBackUrl',
    'signatureUrl',
    'contractUrl',
  ];
  return profile.tipoCliente === 'empresa' ? [...base, 'companyErutUrl'] : base;
}

/** Documents still missing, in the order the contract flow asks for them. */
export function missingDocuments(profile: ClientProfileLike): Array<keyof ClientProfileLike> {
  return requiredDocuments(profile).filter(field => !profile[field]);
}

/**
 * The validation bucket.
 *
 * `validado` requires every document AND accepted terms — the contract is what the pickup rule
 * gates on, so a signed-but-unaccepted profile is not ready. `pendiente` is "almost there": only
 * the contract itself is missing, which is the last step of the flow and the one an admin can
 * chase with a single message. Anything else is `incompleto`.
 */
export function clientValidation(profile: ClientProfileLike): ClientValidation {
  const missing = missingDocuments(profile);

  if (missing.length === 0) return profile.termsAccepted ? 'validado' : 'pendiente';
  if (missing.length === 1 && missing[0] === 'contractUrl') return 'pendiente';
  return 'incompleto';
}

/** Whether this client can legally pick up equipment. */
export function canPickUp(profile: ClientProfileLike): boolean {
  return clientValidation(profile) === 'validado';
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
  if (balance.hasOverdue) return 'con-deuda';
  return balance.outstanding > 0 ? 'pago-pendiente' : 'al-dia';
}

export interface ClientKpis {
  total: number;
  validados: number;
  pendientes: number;
  incompletos: number;
  conDeuda: number;
}

export function clientKpis(
  clients: ReadonlyArray<{ profile: ClientProfileLike; balance: ClientBalanceLike }>
): ClientKpis {
  const kpis: ClientKpis = { total: clients.length, validados: 0, pendientes: 0, incompletos: 0, conDeuda: 0 };

  for (const { profile, balance } of clients) {
    const validation = clientValidation(profile);
    if (validation === 'validado') kpis.validados++;
    else if (validation === 'pendiente') kpis.pendientes++;
    else kpis.incompletos++;

    if (clientFinancial(balance) === 'con-deuda') kpis.conDeuda++;
  }

  return kpis;
}
