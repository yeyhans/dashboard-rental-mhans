interface WPOrderResponse {
  orders: {
    success: boolean;
    orders: WPOrder[];
  }
}

interface WPOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  fotos_garantia: string[];
  correo_enviado: boolean;
  pago_completo: string | null;
}

function ProcessOrder({ order }: { order: WPOrderResponse }) {
  console.log('ProcessOrder received:', order);

  if (!order || !order.orders) {
    console.log('No order data received');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        No se encontraron datos de la orden
      </div>
    );
  }

  if (!order.orders.orders || !Array.isArray(order.orders.orders)) {
    console.log('Orders array is missing or invalid');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        Estructura de datos inválida
      </div>
    );
  }

  const orderData = order.orders.orders[0];

  if (!orderData) {
    console.log('No order found in array');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        No se encontraron datos de la orden
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Estado de Pago</h3>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${orderData.pago_completo === 'completo' ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <p className="text-sm font-medium text-foreground">
            {orderData.pago_completo === 'completo' ? 'Completo' : 'Pendiente'}
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-4">Fotos de productos de la orden</h3>
        
        <div className="space-y-4">

          {/* Warranty Photos */}
          <div className="space-y-2">
            {orderData.fotos_garantia && orderData.fotos_garantia.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {orderData.fotos_garantia.map((foto, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={foto}
                      alt={`Foto de garantía ${index + 1}`}
                      className="object-cover w-full h-full rounded-lg"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No hay fotos de garantía disponibles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProcessOrder
