/**
 * Currency formatting utilities
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Date formatting - DD-MM-AAAA (Chilean standard)
 * Extracted from budget-pdf Astro template
 */
export function formatDateDDMMAAAA(dateString: string): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      // If it's already in DD-MM-AAAA format
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
        return dateString;
      }
      return dateString;
    }

    // Format to DD-MM-AAAA
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Long date format - "1 de enero de 2025"
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Current date in DD-MM-YYYY format
 */
export function getCurrentDateFormatted(): string {
  return new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Budget/Contract number generation
 */
export function generateBudgetNumber(orderId: number): string {
  return `PRES-${orderId}-${Date.now().toString().slice(-6)}`;
}

export function generateContractNumber(userId: number): string {
  return `${userId}-${Date.now().toString().slice(-6)}`;
}

/**
 * Order status translation to Spanish
 */
export function getOrderStatusInSpanish(status: string): string {
  const statusMap: { [key: string]: string } = {
    pending: 'Pendiente',
    processing: 'En Proceso',
    'on-hold': 'En Espera',
    completed: 'Completado',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    failed: 'Fallido',
    draft: 'Borrador',
    trash: 'Eliminado',
  };

  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}
