export interface CreateCanvasPayload {
    canvasId: number;
    costPerPixel: bigint;
    startBlockHeight: bigint;
    endBlockHeight: bigint;
    width: number;
    height: number;
    timeBetweenDraws: number;
    colourPalette: Buffer;
    maxPixelsPerTransaction: number;
}

export interface ChangeCanvasPayload {
    canvasId: number;
    costPerPixel?: bigint | null;
    startBlockHeight?: bigint | null;
    endBlockHeight?: bigint | null;
    width?: number | null;
    height?: number | null;
    timeBetweenDraws?: number | null;
    colourPalette?: Buffer | null;
    maxPixelsPerTransaction?: number | null;
}

export enum CanvasState {
    PENDING = 0,
    ACTIVE = 1,
    COMPLETE = 2,
}

export interface CanvasPayload {
    ownerId: Buffer;
    costPerPixel: bigint;
    startBlockHeight: bigint;
    endBlockHeight: bigint;
    width: number;
    height: number;
    timeBetweenDraws: number;
    colourPalette: Buffer;
    maxPixelsPerTransaction: number;
    state: number;
}

export const canvasSchema = {
    $id: "canvas/canvas",
    type: "object",
    required: ["ownerId", "costPerPixel", "startBlockHeight", "endBlockHeight", "width", "height", "timeBetweenDraws", "colourPalette", "maxPixelsPerTransaction"],
    properties: {
        ownerId: { fieldNumber: 1, dataType: "bytes", minLength: 20, maxLength: 20 },
        costPerPixel: { fieldNumber: 2, dataType: "uint64" },
        startBlockHeight: { fieldNumber: 3, dataType: "uint64" },
        endBlockHeight: { fieldNumber: 4, dataType: "uint64" },
        width: { fieldNumber: 5, dataType: "uint32" },
        height: { fieldNumber: 6, dataType: "uint32" },
        timeBetweenDraws: { fieldNumber: 7, dataType: "uint32" },
        colourPalette: { fieldNumber: 8, dataType: "bytes", minLength: 48, maxLength: 48 },
        maxPixelsPerTransaction: { fieldNumber: 9, dataType: "uint32" },
        state: { fieldNumber: 10, dataType: "uint32", default: CanvasState.PENDING },
    },
};

export interface AccountPayload {
    lastBlockHeight: number;
}

export const accountSchema = {
    $id: "canvas/account",
    type: "object",
    required: ["lastBlockHeight"],
    properties: {
        lastBlockHeight: { fieldNumber: 1, dataType: "uint32" },
    },
};

export interface PendingPayload {
    canvasIds: number[];
}

export const pendingSchema = {
    $id: "canvas/pending",
    type: "object",
    required: ["canvasIds"],
    properties: {
        canvasIds: { fieldNumber: 1, type: "array", items: { dataType: 'uint32' } },
    },
};

export interface ActivePayload {
    canvasIds: number[];
}

export const activeSchema = {
    $id: "canvas/active",
    type: "object",
    required: ["canvasIds"],
    properties: {
        canvasIds: { fieldNumber: 1, type: "array", items: { dataType: 'uint32' } },
    },
};

export interface CompletePayload {
    canvasIds: number[];
}

export const completeSchema = {
    $id: "canvas/complete",
    type: "object",
    required: ["canvasIds"],
    properties: {
        canvasIds: { fieldNumber: 1, type: "array", items: { dataType: 'uint32' } },
    },
};

export interface AddressPayload {
    address: Buffer;
}

export const addressSchema = {
    $id: "canvas/address",
    type: "object",
    required: ["address"],
    properties: {
        address: { fieldNumber: 1, dataType: "bytes", minLength: 20, maxLength: 20 },
    },
};

export interface DrawPixelPayload {
    canvasId: number;
    coords: Buffer;
    colours: Buffer;
}

export interface DrawPixelPayloadJSON {
    canvasId: number;
    coords: string;
    colours: string;
}

export const drawPixelSchema = {
    $id: "canvas/drawPixel/asset",
    title: "DrawPixelAsset transaction asset for Canvas module",
    type: "object",
    required: ["canvasId", "coords", "colours"],
    properties: {
        canvasId: { fieldNumber: 1, dataType: "uint32" },
        coords: { fieldNumber: 2, dataType: "bytes", minLength: 3, maxLength: 30000 },
        colours: { fieldNumber: 3, dataType: "bytes", minLength: 1, maxLength: 5000 },
    },
};

export interface CanvasAccount {
    canvas: { accountType: string }
}

export enum AccountType {
    Admin = "ADMIN",
    Wallet = "WALLET",
    Default = "DEFAULT",
}

export interface CanvasResponse {
    ownerId: string;
    costPerPixel: number;
    startBlockHeight: number;
    endBlockHeight: number;
    width: number;
    height: number;
    timeBetweenDraws: number;
    colourPalette: string;
    maxPixelsPerTransaction: number;
    state: number;
}

export type CanvasId = {
    canvasId: number;
};

export type PixelChangeSubmitted = {
    address: string;
    transactionId: string;
    pixel: DrawPixelPayload;
};

export type PixelChangeCommitted = {
    address: string;
    transactionId: string;
    blockHeight: number;
    pixel: DrawPixelPayload;
};
