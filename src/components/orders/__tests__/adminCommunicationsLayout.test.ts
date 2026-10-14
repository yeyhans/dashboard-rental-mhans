import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * F1 (orders canon RC2.1.2, round 1): at 375px the communications block pushed the order detail
 * to scrollWidth 559. Source assertions because `AdminCommunications` is a stateful island with
 * network effects that `react-dom/server` cannot exercise meaningfully.
 */
const source = readFileSync(
  path.resolve(__dirname, "../AdminCommunications.tsx"),
  "utf8",
);

describe("AdminCommunications narrow-viewport layout", () => {
  it("wraps the header row and its actions instead of overflowing", () => {
    expect(source).toMatch(
      /<CardTitle className="[^"]*flex-wrap[^"]*justify-between/,
    );
    expect(source).toMatch(
      /<div className="flex flex-wrap items-center gap-2">\s*<Button/,
    );
  });

  it("keeps the card inside its column", () => {
    expect(source).toMatch(/<Card className="[^"]*min-w-0[^"]*max-w-full/);
  });

  it("stops the scroll viewport from growing to the widest bubble", () => {
    // Radix ScrollArea wraps children in a `display: table` div that sizes to content.
    expect(source).toContain("[&>[data-radix-scroll-area-viewport]>div]:!block");
  });

  it("breaks long unspaced text such as URLs inside the bubbles", () => {
    expect(source).toContain("[overflow-wrap:anywhere]");
    expect(source).not.toContain('className="text-sm whitespace-pre-wrap break-words"');
  });
});
