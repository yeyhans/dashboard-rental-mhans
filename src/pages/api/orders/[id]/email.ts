import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const { type, message } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!type) {
      return new Response(JSON.stringify({ error: 'Email type is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, user_profiles(*)')
      .eq('id', parseInt(id))
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Email templates
    const emailTemplates = {
      order_confirmation: {
        subject: `Confirmación de Pedido #${id}`,
        template: 'order_confirmation'
      },
      processing_notification: {
        subject: `Su pedido #${id} está siendo procesado`,
        template: 'processing_notification'
      },
      shipping_notification: {
        subject: `Su pedido #${id} ha sido enviado`,
        template: 'shipping_notification'
      },
      completion_notification: {
        subject: `Su pedido #${id} ha sido completado`,
        template: 'completion_notification'
      },
      payment_reminder: {
        subject: `Recordatorio de pago - Pedido #${id}`,
        template: 'payment_reminder'
      },
      custom: {
        subject: `Actualización de su pedido #${id}`,
        template: 'custom'
      }
    };

    const emailConfig = emailTemplates[type as keyof typeof emailTemplates];
    if (!emailConfig) {
      return new Response(JSON.stringify({ error: 'Invalid email type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For now, we'll simulate sending the email
    // In a real implementation, you would integrate with an email service like:
    // - SendGrid
    // - Mailgun
    // - AWS SES
    // - Resend
    
    const emailData = {
      to: order.billing_email,
      subject: emailConfig.subject,
      template: emailConfig.template,
      data: {
        order,
        customMessage: message,
        orderUrl: `${process.env.SITE_URL}/orders/${id}`
      }
    };

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update order to mark email as sent
    await supabase
      .from('orders')
      .update({ 
        correo_enviado: true,
        date_modified: new Date().toISOString()
      })
      .eq('id', parseInt(id));

    // Log the email action for history
    // await logOrderHistory(id, 'email_sent', { type, recipient: order.billing_email });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Email sent successfully to ${order.billing_email}`,
      emailData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in email API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
