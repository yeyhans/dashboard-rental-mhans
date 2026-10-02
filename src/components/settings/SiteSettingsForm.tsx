import React, { useRef, useState } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { SiteSettings } from "../../lib/siteSettings";
import { PageHeader } from "../shared/PageHeader";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import {
  MAX_PICKUP_ADDRESSES,
  addPickupAddress,
  removePickupAddress,
  saveSiteSettings,
  setPickupAddress,
  setSectionField,
  uploadSignature,
  validateSignatureFile,
  type RequestFn,
} from "./siteSettingsClient";

/**
 * Configuración del sitio — the super_admin's editor for the business data used by contracts,
 * budgets and emails (migration 0015). One controlled form, one save button: the whole object is
 * sent on save and the server validates it (the same schema as `lib/siteSettings.ts`). The
 * signature has its own upload because it is a file, not a field.
 */
interface SiteSettingsFormProps {
  initialSettings: SiteSettings;
  /** Tab to open first. Only the tests and deep links need it. */
  initialTab?: TabId;
}

type TabId = "empresa" | "firma" | "banco" | "contacto" | "retiro" | "reserva";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "empresa", label: "Empresa" },
  { id: "firma", label: "Representante y firma" },
  { id: "banco", label: "Banco" },
  { id: "contacto", label: "Contacto" },
  { id: "retiro", label: "Direcciones de retiro" },
  { id: "reserva", label: "Reserva y políticas" },
];

const request: RequestFn = (url, init) =>
  fetch(url, { ...init, credentials: "include" });

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: string;
  multiline?: boolean;
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  type = "text",
  multiline = false,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {children}
      </CardContent>
    </Card>
  );
}

export default function SiteSettingsForm({
  initialSettings,
  initialTab = "empresa",
}: SiteSettingsFormProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [signatureFailed, setSignatureFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const field = <
    S extends Exclude<keyof SiteSettings, "pickupAddresses">,
    K extends keyof SiteSettings[S],
  >(
    section: S,
    key: K,
  ) => ({
    value: String(settings[section][key] ?? ""),
    onChange: (value: string) =>
      setSettings((prev) =>
        setSectionField(prev, section, key, value as SiteSettings[S][K]),
      ),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveSiteSettings(request, settings);
      setSettings(saved);
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const invalid = validateSignatureFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setIsUploading(true);
    try {
      const representative = await uploadSignature(request, file);
      setSettings((prev) => ({ ...prev, representative }));
      setSignatureFailed(false);
      toast.success("Firma actualizada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo subir la firma",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const signatureUrl = settings.representative.signatureUrl;
  const hasSignature = signatureUrl !== "" && !signatureFailed;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración del sitio"
        subtitle="Datos del negocio que usan los contratos, presupuestos y correos"
        actions={
          <Button onClick={handleSave} disabled={isSaving || isUploading}>
            {isSaving && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Guardar cambios
          </Button>
        }
      />

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="empresa">
          <Section
            title="Empresa"
            description="Razón social y datos tributarios que aparecen en los documentos"
          >
            <Field
              id="company-legalName"
              label="Razón social"
              {...field("company", "legalName")}
            />
            <Field
              id="company-tradeName"
              label="Nombre comercial"
              {...field("company", "tradeName")}
            />
            <Field id="company-rut" label="RUT" {...field("company", "rut")} />
            <Field
              id="company-giro"
              label="Giro"
              {...field("company", "giro")}
            />
            <div className="sm:col-span-2">
              <Field
                id="company-domicilio"
                label="Domicilio"
                {...field("company", "domicilio")}
              />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="firma">
          <Section
            title="Representante legal"
            description="Quien firma los contratos como parte arrendadora"
          >
            <Field
              id="rep-name"
              label="Nombre completo"
              {...field("representative", "name")}
            />
            <Field
              id="rep-cedula"
              label="Cédula de identidad"
              {...field("representative", "cedula")}
            />
            <div className="sm:col-span-2">
              <Field
                id="rep-domicilio"
                label="Domicilio"
                {...field("representative", "domicilio")}
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Label htmlFor="signature-file">Firma</Label>
              <div className="flex min-h-[120px] items-center justify-center rounded-md border border-border bg-white p-4">
                {hasSignature ? (
                  <img
                    src={signatureUrl}
                    alt="Firma actual del representante"
                    className="max-h-24 object-contain"
                    onError={() => setSignatureFailed(true)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin firma cargada
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  id="signature-file"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Subir nueva firma
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG o JPEG, hasta 1 MB. Se aplica apenas se sube.
                </p>
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="banco">
          <Section
            title="Cuenta bancaria"
            description="Datos de transferencia que se muestran al cliente"
          >
            <Field
              id="bank-holder"
              label="Titular"
              {...field("bank", "holder")}
            />
            <Field
              id="bank-rut"
              label="RUT del titular"
              {...field("bank", "rut")}
            />
            <Field
              id="bank-bankName"
              label="Banco"
              {...field("bank", "bankName")}
            />
            <Field
              id="bank-accountType"
              label="Tipo de cuenta"
              {...field("bank", "accountType")}
            />
            <Field
              id="bank-accountNumber"
              label="Número de cuenta"
              {...field("bank", "accountNumber")}
            />
            <Field
              id="bank-email"
              label="Correo para comprobantes"
              type="email"
              {...field("bank", "email")}
            />
          </Section>
        </TabsContent>

        <TabsContent value="contacto">
          <Section
            title="Contacto"
            description="Canales públicos y correo que recibe los avisos internos"
          >
            <Field
              id="contact-email"
              label="Correo de contacto"
              type="email"
              {...field("contact", "email")}
            />
            <Field
              id="contact-admin"
              label="Correo de avisos internos"
              type="email"
              hint="Recibe la notificación de cada presupuesto nuevo."
              {...field("contact", "adminNotificationEmail")}
            />
            <Field
              id="contact-phone"
              label="Teléfono"
              {...field("contact", "phone")}
            />
            <Field
              id="contact-whatsapp"
              label="WhatsApp"
              {...field("contact", "whatsapp")}
            />
            <div className="sm:col-span-2">
              <Field
                id="contact-website"
                label="Sitio web"
                {...field("contact", "website")}
              />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="retiro">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Direcciones de retiro</CardTitle>
              <CardDescription>
                Entre 1 y {MAX_PICKUP_ADDRESSES} direcciones donde se retiran
                los equipos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.pickupAddresses.map((address, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field
                      id={`pickup-${index}`}
                      label={`Dirección ${index + 1}`}
                      value={address}
                      onChange={(value) =>
                        setSettings((prev) =>
                          setPickupAddress(prev, index, value),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar dirección ${index + 1}`}
                    disabled={settings.pickupAddresses.length <= 1}
                    onClick={() =>
                      setSettings((prev) => removePickupAddress(prev, index))
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={
                  settings.pickupAddresses.length >= MAX_PICKUP_ADDRESSES
                }
                onClick={() => setSettings((prev) => addPickupAddress(prev))}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Agregar dirección
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reserva">
          <Section
            title="Reserva y políticas"
            description="Porcentaje de reserva por defecto y textos de los documentos"
          >
            <div className="space-y-1.5">
              <Label htmlFor="reserve-pct">Reserva por defecto (%)</Label>
              <Input
                id="reserve-pct"
                type="number"
                min={0}
                max={100}
                step={1}
                value={settings.reserve.defaultPct}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    reserve: {
                      defaultPct:
                        event.target.value === ""
                          ? 0
                          : Number(event.target.value),
                    },
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                El saldo se paga al devolver el equipo.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Field
                id="policies-acceptance"
                label="Texto de aceptación del presupuesto"
                multiline
                hint="Usa {reserva} donde debe ir el monto o porcentaje de la reserva."
                {...field("policies", "acceptance")}
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                id="policies-footer"
                label="Pie de política"
                multiline
                {...field("policies", "footer")}
              />
            </div>
            <Field
              id="policies-pickup"
              label="Ventana de retiro"
              {...field("policies", "pickupWindow")}
            />
            <Field
              id="policies-return"
              label="Plazo de devolución"
              {...field("policies", "returnDeadline")}
            />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
