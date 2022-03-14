export const serialiseCanvasId = (canvasId: number) => `canvas-${canvasId}`;

export const serialisePixelId = (canvasId: number, xCoord: number, yCoord: number) =>
    `${serialiseCanvasId(canvasId)}-pixel-${xCoord}-${yCoord}`;

export const serialiseAccountId = (canvasId: number, address: string) => `${serialiseCanvasId(canvasId)}-account-${address}`;
