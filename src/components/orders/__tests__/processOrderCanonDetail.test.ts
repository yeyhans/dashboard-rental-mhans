import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * T4 (orders canon RC2.1.2): the order detail renders the canon screen — breadcrumb + header,
 * pipeline, main column + 300px aside — from the presentational pieces in `detail/`, while the
 * container keeps today's handlers. Source assertions because `ProcessOrder` is a stateful island
 * with network effects that `react-dom/server` cannot exercise meaningfully.
 */
const source = readFileSync(
  path.resolve(__dirname, "../ProcessOrder.tsx"),
  "utf8",
);

describe("ProcessOrder canon detail layout", () => {
  it("renders the canon header, pipeline and two-column body", () => {
    expect(source).toContain("<OrderDetailHeader");
    expect(source).toContain("<OrderPipeline status={orderData.status} />");
    expect(source).toMatch(/grid-cols-\[minmax\(0,1fr\)_300px\]/);
    expect(source).toMatch(/<aside[^>]*sticky/);
    expect(source).not.toContain("Detalles del Pedido #");
  });

  it("shows the products as the canon table and the aside cards", () => {
    for (const piece of [
      "<OrderItemsTable",
      "<BudgetVersionList",
      "<OrderActionsCard",
      "<OrderClientCard",
      "<OrderDatesCard",
      "<OrderPaymentCard",
      "<OrderFinancialCard",
      "<OrderNoteBlock",
    ]) {
      expect(source).toContain(piece);
    }
  });

  it("keeps today's actions and modules wired", () => {
    expect(source).toContain("onClick={() => setIsEditing(true)}");
    expect(source).toContain("onClick={handleAddToCalendar}");
    expect(source).toContain("onClick: () => setShowEmailModal(true)");
    expect(source).toContain("onClick={() => setIsEditingFinancials(true)}");
    expect(source).toContain("onClick={handleSaveReserveConfig}");
    expect(source).toContain("onDelete={handleDeleteBudgetPdf}");
    expect(source).toContain("<ReturnReportSummary orderId={orderData.id} />");
    expect(source).toContain("<WarrantyImageUpload");
    expect(source).toContain("<AdminCommunications");
    expect(source).toContain("<OrderDriverField orderId={orderData.id} />");
  });

  it("drops the decorative emojis from the financial blocks", () => {
    for (const emoji of ["💰", "💵", "💱", "🎫", "🚚 Costo"]) {
      expect(source).not.toContain(emoji);
    }
  });
});
