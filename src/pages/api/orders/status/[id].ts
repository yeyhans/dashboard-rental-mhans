import type { APIRoute } from 'astro';
import { PUT as updateStatus } from '../[id]/status';

/**
 * Alias URL for `PUT /api/orders/[id]/status`.
 *
 * This route used to carry its own copy of the rules, and the copy had rotted: its allowlist was
 * the seven legacy statuses (five of which migration 0003 makes the database reject), it had no
 * state machine, so an order could jump from `request` straight to `completed` without anyone
 * assigning units by serial number, and it forwarded a `notes` field into
 * `OrderService.updateOrderStatus`, whose third parameter writes `orders.customer_note` — the
 * customer's own message about their order.
 *
 * It delegates now instead of being fixed in parallel. Two routes writing the same column with two
 * copies of the same rules is how the copies drift, and this one drifted silently because nothing
 * in the repository calls it — it is reachable only over HTTP. Both URL shapes resolve `params.id`
 * to the order id, so the handler transfers unchanged.
 *
 * `withCors` is gone deliberately: `src/middleware/index.ts` applies CORS to every `/api/*` route
 * from `ALLOWED_ORIGINS`, and the project convention is not to duplicate it per endpoint.
 */
export const PUT: APIRoute = updateStatus;

export const OPTIONS: APIRoute = async () => new Response(null, { status: 200 });
