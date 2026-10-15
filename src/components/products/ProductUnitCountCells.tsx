import { TableCell } from "../ui/table";
import { UnitStatusPill } from "../inventory/canon/UnitStatusPill";
import { PRODUCT_INVENTORY_STATUS, productInventoryStatus } from "../inventory/canon/unitStatus";
import { CATALOG_UNAVAILABLE_COLUMN_VALUE } from "../../lib/catalogProductColumns";
import type { ProductUnitCounts } from "../../types/inventory";

/**
 * Catalog list columns Stock | Disp. | Arriendo | Estado from real units (`product_unit_counts`,
 * migration 0021). `counts` undefined = not loaded (or the view is missing): explicit placeholder,
 * never a fabricated 0.
 */
export function ProductUnitCountCells({ counts }: { counts: ProductUnitCounts | undefined }) {
  const number = "p-2 text-center font-mono text-xs tabular-nums";

  if (!counts) {
    return (
      <>
        <TableCell className={`${number} text-muted-foreground`}>{CATALOG_UNAVAILABLE_COLUMN_VALUE}</TableCell>
        <TableCell className={`${number} text-muted-foreground`}>{CATALOG_UNAVAILABLE_COLUMN_VALUE}</TableCell>
        <TableCell className={`${number} text-muted-foreground`}>{CATALOG_UNAVAILABLE_COLUMN_VALUE}</TableCell>
        <TableCell className="p-2 text-2xs text-muted-foreground">{CATALOG_UNAVAILABLE_COLUMN_VALUE}</TableCell>
      </>
    );
  }

  const status = PRODUCT_INVENTORY_STATUS[productInventoryStatus(counts)];
  return (
    <>
      <TableCell className={`${number} text-[#111111]`}>{counts.total}</TableCell>
      <TableCell className={`${number} ${counts.available > 0 ? "text-[#256B44]" : "text-[#666666]"}`}>{counts.available}</TableCell>
      <TableCell className={`${number} ${counts.in_rental > 0 ? "text-[#2E5490]" : "text-[#666666]"}`}>{counts.in_rental}</TableCell>
      <TableCell className="p-2">
        <UnitStatusPill tone={status.tone} label={status.label} />
      </TableCell>
    </>
  );
}

export default ProductUnitCountCells;
