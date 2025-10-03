/**
 * Integración simple de Google Calendar
 * Crea recordatorios completos con toda la información de la orden
 */

export interface SimpleCalendarEvent {
  orderId: number;
  projectName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  startDate: string;
  endDate: string;
  numDays: number;
  equipments: string[];
  total: string;
  notes: string;
}

/**
 * Crea un enlace directo para agregar evento a Google Calendar
 * No requiere API keys ni autenticación
 */
export function createGoogleCalendarLink(eventData: SimpleCalendarEvent): string {
  const { 
    orderId, 
    projectName, 
    customerName, 
    customerEmail, 
    customerPhone, 
    customerAddress,
    startDate, 
    endDate, 
    numDays,
    equipments,
    total,
    notes
  } = eventData;
  
  // Título del evento
  const title = `🏗️ ${projectName} - Orden #${orderId}`;
  
  // Crear descripción detallada
  const equipmentsList = equipments.length > 0 
    ? equipments.map(eq => `• ${eq}`).join('\n')
    : '• No hay equipos especificados';

  const description = `
🏗️ PROYECTO DE ALQUILER DE EQUIPOS

📋 Detalles de la Orden:
• ID de Orden: #${orderId}
• Proyecto: ${projectName}
• Duración: ${numDays} día(s)
• Total: $${total}

👤 Cliente:
• Nombre: ${customerName}
${customerEmail ? `• Email: ${customerEmail}` : ''}
${customerPhone ? `• Teléfono: ${customerPhone}` : ''}
${customerAddress ? `• Dirección: ${customerAddress}` : ''}

🛠️ Equipos Alquilados:
${equipmentsList}

📝 Notas:
${notes || 'Sin notas adicionales'}

🔔 Recordatorios Importantes:
• Verificar disponibilidad de equipos antes del evento
• Confirmar detalles de entrega con el cliente
• Preparar documentación de alquiler
• Revisar estado de equipos post-alquiler
• Coordinar logística de transporte

📞 Contactar al cliente 24h antes para confirmar detalles
  `.trim();
  
  // Convertir fechas a formato Google Calendar (YYYYMMDD)
  const formatDateForGoogle = (dateStr: string): string => {
    // Si viene en formato YYYY-MM-DD, convertir a YYYYMMDD
    if (dateStr.includes('-')) {
      return dateStr.replace(/-/g, '');
    }
    return dateStr;
  };
  
  const googleStartDate = formatDateForGoogle(startDate);
  const googleEndDate = formatDateForGoogle(endDate);
  
  // Crear URL de Google Calendar
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${googleStartDate}/${googleEndDate}`,
    details: description,
    location: customerAddress || 'Dirección por confirmar',
    trp: 'false' // No mostrar en modo transparente
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Abre Google Calendar para agregar el evento
 */
export function openGoogleCalendar(eventData: SimpleCalendarEvent): void {
  const calendarUrl = createGoogleCalendarLink(eventData);
  
  // Abrir en nueva ventana
  if (typeof window !== 'undefined') {
    window.open(calendarUrl, '_blank', 'width=600,height=600');
  }
}

/**
 * Crea datos del evento desde una orden con toda la información disponible
 */
export function createEventFromOrder(orderData: any): SimpleCalendarEvent {
  console.log('🔍 Creating calendar event from order data:', {
    id: orderData.id,
    hasLineItems: !!orderData.line_items,
    lineItemsCount: orderData.line_items?.length || 0,
    hasCustomer: !!orderData.customer,
    hasBilling: !!(orderData.billing_first_name || orderData.billing_last_name)
  });

  // Información del cliente
  const customerName = `${orderData.billing_first_name || ''} ${orderData.billing_last_name || ''}`.trim() || 
                      `${orderData.customer?.first_name || ''} ${orderData.customer?.last_name || ''}`.trim() || 
                      'Cliente';
  
  const customerEmail = orderData.billing_email || orderData.customer?.email || '';
  const customerPhone = orderData.billing_phone || orderData.customer?.phone || '';
  
  // Dirección completa
  const addressParts = [
    orderData.billing_address_1,
    orderData.billing_address_2,
    orderData.billing_city,
    orderData.billing_state,
    orderData.billing_postcode
  ].filter(Boolean);
  const customerAddress = addressParts.join(', ');

  // Información del proyecto
  const projectName = orderData.order_proyecto || `Proyecto Orden #${orderData.id || 'N/A'}`;
  
  // Extraer equipos de line_items
  const equipments: string[] = [];
  if (orderData.line_items && Array.isArray(orderData.line_items)) {
    orderData.line_items.forEach((item: any) => {
      const itemName = item.name || item.product_name || 'Producto sin nombre';
      const quantity = item.quantity || 1;
      const price = item.price || item.total || '0';
      
      equipments.push(`${itemName} (Cantidad: ${quantity}, Precio: $${price})`);
    });
  }

  // Calcular número de días
  const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
  
  // Total de la orden
  const total = orderData.total || orderData.calculated_total || orderData.grand_total || '0';
  
  // Notas adicionales
  const notesParts = [
    orderData.customer_note ? `Nota del cliente: ${orderData.customer_note}` : '',
    orderData.order_notes ? `Notas de la orden: ${orderData.order_notes}` : '',
    orderData.admin_notes ? `Notas administrativas: ${orderData.admin_notes}` : ''
  ].filter(Boolean);
  const notes = notesParts.join('\n') || 'Sin notas adicionales';

  // Formatear fechas a YYYY-MM-DD
  const formatDate = (dateStr: string): string => {
    if (!dateStr) {
      const today = new Date();
      return today.toISOString().split('T')[0] || '2025-01-01';
    }
    
    // Si ya está en formato YYYY-MM-DD, retornar tal como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Si está en formato DD-MM-YYYY, convertir
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('-');
      return `${year}-${month}-${day}`;
    }
    
    // Fallback
    const today = new Date();
    return today.toISOString().split('T')[0] || '2025-01-01';
  };

  const eventData = {
    orderId: orderData.id || 0,
    projectName,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    startDate: formatDate(orderData.order_fecha_inicio || ''),
    endDate: formatDate(orderData.order_fecha_termino || ''),
    numDays,
    equipments,
    total: total.toString(),
    notes
  };

  console.log('✅ Calendar event data created:', {
    orderId: eventData.orderId,
    projectName: eventData.projectName,
    customerName: eventData.customerName,
    equipmentsCount: eventData.equipments.length,
    startDate: eventData.startDate,
    endDate: eventData.endDate
  });

  return eventData;
}
