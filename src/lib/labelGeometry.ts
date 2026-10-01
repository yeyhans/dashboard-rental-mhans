/**
 * Physical geometry of the asset label. Dependency-free on purpose: the print sheet island reads
 * it in the browser, and importing it through `assetLabel.ts` would pull the whole bwip-js
 * encoder into the client bundle for one constant. `assetLabel.ts` re-exports it for callers on
 * the server.
 */

/** Brother QL DK-11209 die-cut label, the printer recommended to the client. Millimetres. */
export const LABEL_MM = { width: 62, height: 29 } as const;
