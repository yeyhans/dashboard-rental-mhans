import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * T-014b. Two things were wrong here.
 *
 * 1. These notifications reached `order_communications` through the anon PostgREST client, which
 *    migration 0001 revokes. They now go through `communicationsService`, i.e. the admin-gated
 *    API route. (The sweep classified this service as server-side; it is not — `ProcessOrder.tsx`
 *    reaches it via the `useOrderNotifications` hook, so it runs in the browser.)
 *
 * 2. Every call passed arguments in the wrong positional order, so the literal string `'text'`
 *    was stored as `user_name` and the admin's display name landed in `file_url`. 669 rows in
 *    production carry that corruption.
 */
const sendMessage = vi.fn();

vi.mock('../communicationsService', () => ({
  communicationsService: { sendMessage },
}));

const orderData = {
  orderId: 42,
  customerId: '9',
  customerName: 'Ana Pérez',
  customerEmail: 'cliente@x.cl',
  adminId: 'admin-1',
  adminName: 'Administrador',
  adminEmail: 'rental.mariohans@gmail.com',
};

/** sendMessage(orderId, userId, userType, message, userName?, userEmail?, messageType?, fileUrl?, fileName?) */
function lastCall() {
  const [orderId, userId, userType, message, userName, userEmail, messageType, fileUrl, fileName] =
    sendMessage.mock.calls.at(-1) as unknown[];
  return { orderId, userId, userType, message, userName, userEmail, messageType, fileUrl, fileName };
}

describe('orderNotificationService', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMessage.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores the admin display name in user_name, not in file_url', async () => {
    const { orderNotificationService } = await import('../orderNotificationService');

    await orderNotificationService.notifyEmailSent(orderData, {
      emailType: 'budget_notification',
      emailSubject: 'Presupuesto',
      emailRecipient: 'cliente@x.cl',
      success: true,
    });

    const call = lastCall();
    expect(call.userName).toBe('📧 Administrador');
    expect(call.userEmail).toBe('rental.mariohans@gmail.com');
    // messageType is left to the `= 'text'` default of sendMessage; what matters is that no
    // value leaks into the userName/userEmail/file slots.
    expect(call.messageType).toBeUndefined();
    expect(call.fileUrl).toBeUndefined();
    expect(call.fileName).toBeUndefined();
  });

  it('sends status-change notifications as plain admin text messages', async () => {
    const { orderNotificationService } = await import('../orderNotificationService');

    await orderNotificationService.notifyStatusChange(orderData, {
      oldStatus: 'on-hold',
      newStatus: 'processing',
    });

    const call = lastCall();
    expect(call.orderId).toBe(42);
    expect(call.userId).toBe('admin-1');
    expect(call.userType).toBe('admin');
    // Una fila legada se rotula por su ETAPA canónica: `on-hold` es Solicitud, `processing` es
    // Confirmado. El admin lee un solo vocabulario aunque la columna todavía no se haya migrado.
    expect(call.message).toContain('Solicitud');
    expect(call.message).toContain('Confirmado');
    expect(call.userName).toBe('🔄 Administrador');
    expect(call.fileUrl).toBeUndefined();
  });

  it('sends PDF notifications without faking a file attachment', async () => {
    const { orderNotificationService } = await import('../orderNotificationService');

    await orderNotificationService.notifyPdfGenerated(orderData, 'budget', 'https://r2/x.pdf', true);

    const call = lastCall();
    expect(call.userName).toBe('📄 Administrador');
    expect(call.messageType).toBeUndefined();
    expect(call.fileUrl).toBeUndefined();
    expect(call.fileName).toBeUndefined();
  });

  it('swallows transport errors so the main flow is not interrupted', async () => {
    sendMessage.mockRejectedValue(new Error('401'));
    const { orderNotificationService } = await import('../orderNotificationService');

    await expect(
      orderNotificationService.notifyStatusChange(orderData, { oldStatus: 'on-hold', newStatus: 'processing' })
    ).resolves.toBeUndefined();
  });
});
