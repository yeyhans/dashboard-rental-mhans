import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { FileText, FileCheck } from "lucide-react";





function OrderEstado({ order, handleStatusUpdate, loading }: { order: any, handleStatusUpdate: any, loading: any }) {
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
                  onChange={(e) => handleStatusUpdate(parseInt(order.id), e.target.value)}
                  disabled={loading}
                >
                  {Object.entries(statusTranslations).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
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
              <div className="mt-1">{formatDate(order.date_modified)}</div>
            </div>
          </div>

          {/* Enlaces a PDFs */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            {order.metadata.pdf_on_hold_url && (
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-auto py-3"
                onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="text-left">Ver PDF de Presupuesto</span>
              </Button>
            )}
            {order.metadata.pdf_processing_url && (
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-auto py-3"
                onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
              >
                <FileCheck className="h-4 w-4 shrink-0" />
                <span className="text-left">Ver PDF de Contrato</span>
              </Button>
            )}
          </div>
    </div>
  )
}
export default OrderEstado