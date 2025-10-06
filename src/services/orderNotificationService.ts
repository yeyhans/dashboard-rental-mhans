import { communicationsService } from './communicationsService';

export interface OrderNotificationData {
  orderId: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
}

export interface EmailNotificationData {
  emailType: string;
  emailSubject: string;
  emailRecipient: string;
  emailContent?: string;
  attachments?: string[];
  success: boolean;
  errorMessage?: string;
}

export interface StatusChangeNotificationData {
  oldStatus: string;
  newStatus: string;
  reason?: string;
  additionalInfo?: string;
}

class OrderNotificationService {
  private defaultAdminInfo = {
    id: 'system-admin',
    name: 'Sistema Administrativo',
    email: 'admin@rental-mhans.com'
  };

  /**
   * Notificar envío de correo electrónico al cliente
   */
  async notifyEmailSent(
    orderData: OrderNotificationData,
    emailData: EmailNotificationData
  ): Promise<void> {
    try {
      const adminInfo = {
        id: orderData.adminId || this.defaultAdminInfo.id,
        name: orderData.adminName || this.defaultAdminInfo.name,
        email: orderData.adminEmail || this.defaultAdminInfo.email
      };

      let message = '';
      let messageType: 'text' | 'image' | 'file' = 'text';

      if (emailData.success) {
        message = this.buildSuccessEmailMessage(emailData);
      } else {
        message = this.buildFailedEmailMessage(emailData);
      }

      await communicationsService.sendMessage(
        orderData.orderId,
        adminInfo.id,
        'admin',
        message,
        messageType,
        undefined,
        undefined,
        `📧 ${adminInfo.name}`,
        adminInfo.email
      );

      console.log(`✅ Email notification sent for order ${orderData.orderId}: ${emailData.emailType}`);
    } catch (error) {
      console.error('❌ Error sending email notification:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Notificar cambio de estado de la orden
   */
  async notifyStatusChange(
    orderData: OrderNotificationData,
    statusData: StatusChangeNotificationData
  ): Promise<void> {
    try {
      const adminInfo = {
        id: orderData.adminId || this.defaultAdminInfo.id,
        name: orderData.adminName || this.defaultAdminInfo.name,
        email: orderData.adminEmail || this.defaultAdminInfo.email
      };

      const message = this.buildStatusChangeMessage(statusData);

      await communicationsService.sendMessage(
        orderData.orderId,
        adminInfo.id,
        'admin',
        message,
        'text',
        undefined,
        undefined,
        `🔄 ${adminInfo.name}`,
        adminInfo.email
      );

      console.log(`✅ Status change notification sent for order ${orderData.orderId}: ${statusData.oldStatus} → ${statusData.newStatus}`);
    } catch (error) {
      console.error('❌ Error sending status change notification:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Notificar generación de PDF (presupuesto, contrato, etc.)
   */
  async notifyPdfGenerated(
    orderData: OrderNotificationData,
    pdfType: 'budget' | 'contract' | 'processing',
    pdfUrl: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      const adminInfo = {
        id: orderData.adminId || this.defaultAdminInfo.id,
        name: orderData.adminName || this.defaultAdminInfo.name,
        email: orderData.adminEmail || this.defaultAdminInfo.email
      };

      let message = '';
      const pdfTypeNames = {
        budget: 'Presupuesto',
        contract: 'Contrato',
        processing: 'Procesamiento'
      };

      if (success) {
        message = `📄 **${pdfTypeNames[pdfType]}** generado - [Ver documento](${pdfUrl})`;
      } else {
        message = `❌ **Error** generando ${pdfTypeNames[pdfType]} - ${errorMessage || 'Error desconocido'}`;
      }

      await communicationsService.sendMessage(
        orderData.orderId,
        adminInfo.id,
        'admin',
        message,
        'text',
        undefined,
        undefined,
        `📄 ${adminInfo.name}`,
        adminInfo.email
      );

      console.log(`✅ PDF generation notification sent for order ${orderData.orderId}: ${pdfType}`);
    } catch (error) {
      console.error('❌ Error sending PDF generation notification:', error);
    }
  }



  /**
   * Construir mensaje de éxito para envío de correo (compacto)
   */
  private buildSuccessEmailMessage(emailData: EmailNotificationData): string {
    const emailTypeNames: { [key: string]: string } = {
      'warranty_photos': 'Fotos Garantía',
      'availability_confirmation': 'Confirmación',
      'order_update': 'Actualización',
      'budget_notification': 'Presupuesto',
      'contract_notification': 'Contrato',
      'processing_notification': 'Procesamiento',
      'completion_notification': 'Finalización',
      'custom': 'Personalizado'
    };

    const emailTypeName = emailTypeNames[emailData.emailType] || emailData.emailType;
    const attachmentCount = emailData.attachments?.length || 0;
    const attachmentText = attachmentCount > 0 ? ` (${attachmentCount} adj.)` : '';

    return `📧 **${emailTypeName}** enviado a ${emailData.emailRecipient}${attachmentText}`;
  }

  /**
   * Construir mensaje de error para envío de correo (compacto)
   */
  private buildFailedEmailMessage(emailData: EmailNotificationData): string {
    const emailTypeNames: { [key: string]: string } = {
      'warranty_photos': 'Fotos Garantía',
      'availability_confirmation': 'Confirmación',
      'order_update': 'Actualización',
      'budget_notification': 'Presupuesto',
      'contract_notification': 'Contrato',
      'processing_notification': 'Procesamiento',
      'completion_notification': 'Finalización',
      'custom': 'Personalizado'
    };

    const emailTypeName = emailTypeNames[emailData.emailType] || emailData.emailType;

    return `❌ **Error** enviando ${emailTypeName} a ${emailData.emailRecipient}`;
  }

  /**
   * Construir mensaje para cambio de estado (compacto)
   */
  private buildStatusChangeMessage(statusData: StatusChangeNotificationData): string {
    const statusNames: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'En Proceso',
      'on-hold': 'En Espera',
      'completed': 'Completado',
      'cancelled': 'Cancelado',
      'failed': 'Fallido',
      'refunded': 'Reembolsado'
    };

    const oldStatusName = statusNames[statusData.oldStatus] || statusData.oldStatus;
    const newStatusName = statusNames[statusData.newStatus] || statusData.newStatus;

    // Determinar emoji según el nuevo estado
    let emoji = '🔄';
    switch (statusData.newStatus) {
      case 'completed':
        emoji = '✅';
        break;
      case 'failed':
        emoji = '❌';
        break;
      case 'cancelled':
        emoji = '❌';
        break;
      case 'refunded':
        emoji = '💸';
        break;
      default:
        emoji = '🔄';
    }

    const reasonText = statusData.reason ? ` - ${statusData.reason}` : '';
    return `${emoji} **Estado:** ${oldStatusName} → ${newStatusName}${reasonText}`;
  }
}

export const orderNotificationService = new OrderNotificationService();
