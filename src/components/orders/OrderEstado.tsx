import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { STATUS_OPTIONS, canTransition, isOrderStatus } from "../../lib/orderStatus";

// Icons as SVG components
const FileTextIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const FileCheckIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Las opciones vienen de `src/lib/orderStatus.ts`. La lista escrita a mano que habia aqui
// ofrecia nueve valores, dos de los cuales — `trash` y `auto-draft` — el CHECK de la tabla nunca
// admitio: elegirlos producia una violacion de constraint que el endpoint devolvia como 500.

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

interface OrderEstadoProps {
  order: {
    id: number;
    status: string;
    date_created: string;
    date_modified?: string;
    metadata?: {
      pdf_on_hold_url?: string;
      pdf_processing_url?: string;
    };
    new_pdf_on_hold_url?: string;
    new_pdf_processing_url?: string;
  };
  handleStatusUpdate: (orderId: number, newStatus: string) => void;
  loading: boolean;
}

function OrderEstado({ order, handleStatusUpdate, loading }: OrderEstadoProps) {
  return (
    <div>
      {/* Estado y Fechas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <Label className="font-medium">Estado</Label>
          <div className="mt-1 flex items-center gap-2">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={order.status}
              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
              disabled={loading}
            >
              {STATUS_OPTIONS.map(({ value, label }) => {
                // Area 01 §5: "ninguna vista permite saltar un estado". El endpoint ya devuelve
                // 409 ante un salto, pero dejar la opcion elegible convierte un clic equivocado
                // en un error; deshabilitarla lo convierte en algo que no se puede hacer.
                // El estado actual queda habilitado para que el <select> pueda mostrarlo.
                const isCurrent = value === order.status;
                const isLegal = isOrderStatus(order.status)
                  ? canTransition(order.status, value)
                  : true; // origen legado: la maquina no lo conoce, no puede juzgarlo
                return (
                  <option key={value} value={value} disabled={!isCurrent && !isLegal}>
                    {label}
                  </option>
                );
              })}
            </select>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            )}
          </div>
        </div>
        <div>
          <Label className="font-medium">Fecha de Creación</Label>
          <div className="mt-1">{formatDate(order.date_created)}</div>
        </div>
        <div>
          <Label className="font-medium">Última Modificación</Label>
          <div className="mt-1">{formatDate(order.date_modified || order.date_created)}</div>
        </div>
      </div>

      {/* Enlaces a PDFs */}
      <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
        {(order.metadata?.pdf_on_hold_url || order.new_pdf_on_hold_url) && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-3"
            onClick={() => window.open(order.metadata?.pdf_on_hold_url || order.new_pdf_on_hold_url, '_blank')}
          >
            <FileTextIcon />
            <span className="text-left">Ver PDF de Presupuesto</span>
          </Button>
        )}
        {(order.metadata?.pdf_processing_url || order.new_pdf_processing_url) && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-3"
            onClick={() => window.open(order.metadata?.pdf_processing_url || order.new_pdf_processing_url, '_blank')}
          >
            <FileCheckIcon />
            <span className="text-left">Ver PDF de Contrato</span>
          </Button>
        )}
      </div>
    </div>
  )
}
export default OrderEstado