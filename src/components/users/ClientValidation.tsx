import type { UserProfile } from "../../types/user";
import { calculateCompletionPercentage } from "./utils/userUtils";
import { StatusBadge } from "../shared/StatusBadge";
import type { BadgeTone } from "../shared/statusBadgeTones";
import {
  clientValidationReport,
  VALIDATION_LABELS,
  type ClientProfileLike,
  type ClientValidation,
  type ClientValidationReport,
} from "../../lib/clientStatus";

// Canon tones for the validation bucket (06.1): Validado ok, Pendiente and Incompleto warn.
export const VALIDATION_TONES: Record<ClientValidation, BadgeTone> = {
  validado: "ok",
  pendiente: "warn",
  incompleto: "warn",
};

/** Adapter: the status logic is profile-shaped, the list/ficha work with `UserProfile` rows. */
export function toProfileLike(user: UserProfile): ClientProfileLike {
  return {
    tipoCliente: user.tipo_cliente,
    contractUrl: user.url_user_contrato,
    rutFrontUrl: user.url_rut_anverso,
    rutBackUrl: user.url_rut_reverso,
    signatureUrl: user.url_firma,
    companyErutUrl: user.new_url_e_rut_empresa ?? user.url_empresa_erut,
    termsAccepted: Boolean(user.terminos_aceptados),
  };
}

export function validationReport(user: UserProfile): ClientValidationReport {
  return clientValidationReport(toProfileLike(user));
}

/** "Falta: términos aceptados, contrato firmado" — empty when nothing is missing. */
export function missingSummary(user: UserProfile): string {
  const { missing } = validationReport(user);
  if (missing.length === 0) return "";
  return `Falta: ${missing.map((m) => m.label.toLowerCase()).join(", ")}`;
}

/**
 * Whether the "perfil 100% completo" message may be shown: the profile fields are all filled AND
 * the client is validated. The percentage does not count the contract, so a 100% profile can still
 * be Pendiente; saying "100% completo" next to that badge would contradict it.
 */
export function isFullyComplete(user: UserProfile): boolean {
  return (
    calculateCompletionPercentage(user) === 100 &&
    validationReport(user).status === "validado"
  );
}

/** The status pill, with the reason as a tooltip so the list explains itself. */
export function ClientValidationBadge({ user }: { user: UserProfile }) {
  const { status } = validationReport(user);
  const reason = missingSummary(user) || "Términos y documentación al día";
  return (
    <span title={reason}>
      <StatusBadge
        tone={VALIDATION_TONES[status]}
        label={VALIDATION_LABELS[status]}
      />
    </span>
  );
}

/** Compact checklist of every requirement for the ficha; neutral text, tone only on the state. */
export function ClientRequirementsChecklist({ user }: { user: UserProfile }) {
  const { requirements } = validationReport(user);
  return (
    <ul className="space-y-1.5" aria-label="Requisitos de validación">
      {requirements.map((req) => (
        <li
          key={req.key}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="text-foreground">{req.label}</span>
          <StatusBadge
            tone={req.met ? "ok" : "warn"}
            label={req.met ? "Listo" : "Falta"}
          />
        </li>
      ))}
    </ul>
  );
}
