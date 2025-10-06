import { useCallback } from 'react';
import { orderNotificationService, type OrderNotificationData, type EmailNotificationData, type StatusChangeNotificationData } from '../services/orderNotificationService';
import { toast } from 'sonner';

interface UseOrderNotificationsProps {
  orderId: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
}

export function useOrderNotifications({
  orderId,
  customerId,
  customerName,
  customerEmail,
  adminId,
  adminName,
  adminEmail
}: UseOrderNotificationsProps) {
  
  const orderData: OrderNotificationData = {
    orderId,
    customerId,
    customerName,
    customerEmail,
    ...(adminId && { adminId }),
    ...(adminName && { adminName }),
    ...(adminEmail && { adminEmail })
  };

  /**
   * Notificar envío de correo exitoso
   */
  const notifyEmailSent = useCallback(async (
    emailType: string,
    emailSubject: string,
    emailRecipient: string,
    emailContent?: string,
    attachments?: string[]
  ) => {
    try {
      const emailData: EmailNotificationData = {
        emailType,
        emailSubject,
        emailRecipient,
        ...(emailContent && { emailContent }),
        ...(attachments && { attachments }),
        success: true
      };

      await orderNotificationService.notifyEmailSent(orderData, emailData);
      
      // Toast para el admin
      toast.success('Notificación de correo enviada al cliente', {
        description: `Tipo: ${emailType}`
      });
    } catch (error) {
      console.error('Error notifying email sent:', error);
      toast.error('Error al notificar envío de correo');
    }
  }, [orderData]);

  /**
   * Notificar error en envío de correo
   */
  const notifyEmailFailed = useCallback(async (
    emailType: string,
    emailSubject: string,
    emailRecipient: string,
    errorMessage: string,
    emailContent?: string
  ) => {
    try {
      const emailData: EmailNotificationData = {
        emailType,
        emailSubject,
        emailRecipient,
        ...(emailContent && { emailContent }),
        success: false,
        errorMessage
      };

      await orderNotificationService.notifyEmailSent(orderData, emailData);
      
      // Toast para el admin
      toast.warning('Notificación de error de correo enviada al cliente', {
        description: `Error: ${errorMessage}`
      });
    } catch (error) {
      console.error('Error notifying email failure:', error);
      toast.error('Error al notificar fallo de correo');
    }
  }, [orderData]);

  /**
   * Notificar cambio de estado
   */
  const notifyStatusChange = useCallback(async (
    oldStatus: string,
    newStatus: string,
    reason?: string,
    additionalInfo?: string
  ) => {
    try {
      const statusData: StatusChangeNotificationData = {
        oldStatus,
        newStatus,
        ...(reason && { reason }),
        ...(additionalInfo && { additionalInfo })
      };

      await orderNotificationService.notifyStatusChange(orderData, statusData);
      
      // Toast para el admin
      toast.success('Notificación de cambio de estado enviada', {
        description: `${oldStatus} → ${newStatus}`
      });
    } catch (error) {
      console.error('Error notifying status change:', error);
      toast.error('Error al notificar cambio de estado');
    }
  }, [orderData]);

  /**
   * Notificar generación de PDF
   */
  const notifyPdfGenerated = useCallback(async (
    pdfType: 'budget' | 'contract' | 'processing',
    pdfUrl: string,
    success: boolean = true,
    errorMessage?: string
  ) => {
    try {
      await orderNotificationService.notifyPdfGenerated(
        orderData,
        pdfType,
        pdfUrl,
        success,
        errorMessage
      );
      
      // Toast para el admin
      if (success) {
        toast.success(`Notificación de ${pdfType} enviada al cliente`, {
          description: 'PDF generado exitosamente'
        });
      } else {
        toast.warning(`Notificación de error de ${pdfType} enviada`, {
          description: errorMessage || 'Error en generación'
        });
      }
    } catch (error) {
      console.error('Error notifying PDF generation:', error);
      toast.error('Error al notificar generación de PDF');
    }
  }, [orderData]);

  /**
   * Notificar múltiples acciones (batch)
   */
  const notifyBatchActions = useCallback(async (actions: Array<{
    type: 'email' | 'status' | 'pdf';
    data: any;
  }>) => {
    try {
      const promises = actions.map(async (action) => {
        switch (action.type) {
          case 'email':
            if (action.data.success) {
              return notifyEmailSent(
                action.data.emailType,
                action.data.emailSubject,
                action.data.emailRecipient,
                action.data.emailContent,
                action.data.attachments
              );
            } else {
              return notifyEmailFailed(
                action.data.emailType,
                action.data.emailSubject,
                action.data.emailRecipient,
                action.data.errorMessage,
                action.data.emailContent
              );
            }
          case 'status':
            return notifyStatusChange(
              action.data.oldStatus,
              action.data.newStatus,
              action.data.reason,
              action.data.additionalInfo
            );
          case 'pdf':
            return notifyPdfGenerated(
              action.data.pdfType,
              action.data.pdfUrl,
              action.data.success,
              action.data.errorMessage
            );
          default:
            console.warn('Unknown notification action type:', action.type);
        }
      });

      await Promise.allSettled(promises);
      
      toast.success(`${actions.length} notificaciones enviadas al cliente`);
    } catch (error) {
      console.error('Error in batch notifications:', error);
      toast.error('Error al enviar notificaciones en lote');
    }
  }, [notifyEmailSent, notifyEmailFailed, notifyStatusChange, notifyPdfGenerated]);

  return {
    notifyEmailSent,
    notifyEmailFailed,
    notifyStatusChange,
    notifyPdfGenerated,
    notifyBatchActions
  };
}
