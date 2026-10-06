/**
 * Helpers for the hidden native `<input type="date">` behind a button (Check-In date filter).
 */

/** The subset of `HTMLInputElement` that `openDatePicker` touches (easy to fake in tests). */
export interface DatePickerInput {
  showPicker?: () => void;
  focus: () => void;
  click?: () => void;
}

export type OpenDatePickerResult = "none" | "picker" | "fallback";

/**
 * Opens the native date picker. `showPicker()` throws `NotAllowedError` without a user gesture
 * and `SecurityError` inside cross-origin iframes, and is missing in older browsers, so it must
 * never be called bare: on any failure fall back to focusing and clicking the input, which opens
 * the picker (or at least focuses the field) in the browsers that lack `showPicker()`.
 */
export function openDatePicker(
  input: DatePickerInput | null,
): OpenDatePickerResult {
  if (!input) return "none";
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return "picker";
    } catch {
      // fall through to the focus/click fallback
    }
  }
  try {
    input.focus();
    input.click?.();
  } catch {
    // nothing else to try; the control must never throw from a click handler
  }
  return "fallback";
}

/** `YYYY-MM-DD` to `DD/MM/YYYY`; empty string for the no-date state or any non-ISO value. */
export function formatIsoDateLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}
