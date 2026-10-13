import React from "react";
import {
  manualDiscountAmount,
  type ManualDiscountInput,
  type ManualDiscountMode,
} from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * R-05: "Descuento" on an order without a coupon, by percentage or by amount.
 *
 * Shows the amount it will discount (products subtotal; shipping is never discounted, same as a
 * coupon). Only a preview: the server recomputes the discount when the order is saved. Disabled
 * while a coupon is applied, because the coupon takes precedence.
 */
interface OrderDiscountControlProps {
  idPrefix: string;
  value: ManualDiscountInput;
  onChange: (value: ManualDiscountInput) => void;
  productsSubtotal: number;
  disabled?: boolean;
}

const MODES: ReadonlyArray<{
  mode: ManualDiscountMode;
  label: string;
  name: string;
}> = [
  { mode: "percent", label: "%", name: "Descuento en porcentaje" },
  { mode: "fixed", label: "$", name: "Descuento en pesos" },
];

export default function OrderDiscountControl({
  idPrefix,
  value,
  onChange,
  productsSubtotal,
  disabled = false,
}: OrderDiscountControlProps) {
  const inputId = `${idPrefix}-manual-discount`;
  const amount = disabled ? 0 : manualDiscountAmount(value, productsSubtotal);

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Descuento</Label>
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Tipo de descuento" className="flex">
          {MODES.map(({ mode, label, name }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={value.mode === mode ? "true" : "false"}
              aria-label={name}
              disabled={disabled}
              onClick={() => onChange({ mode, value: "" })}
              className={`h-9 w-9 border text-sm first:rounded-l-md last:rounded-r-md disabled:opacity-50 ${
                value.mode === mode
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-background"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={0}
          max={value.mode === "percent" ? 100 : undefined}
          step={value.mode === "percent" ? 0.01 : 1}
          value={value.value}
          disabled={disabled}
          placeholder={value.mode === "percent" ? "0 a 100" : "Monto"}
          onChange={(e) =>
            onChange({ mode: value.mode, value: e.target.value })
          }
          className="w-32"
        />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {amount > 0 ? `-$${amount.toLocaleString("es-CL")}` : "Sin descuento"}
        </span>
      </div>
      {disabled && (
        <p className="text-xs text-muted-foreground">
          El cupón aplicado reemplaza este descuento.
        </p>
      )}
    </div>
  );
}
