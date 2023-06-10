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
    state: number;
}

export const canvasSchema = {
    $id: "canvas/canvas",
    type: "object",
    required: ["ownerId", "costPerPixel", "startBlockHeight", "endBlockHeight", "width", "height", "timeBetweenDraws"],
    properties: {
        ownerId: { fieldNumber: 1, dataType: "bytes", minLength: 20, maxLength: 20 },
        costPerPixel: { fieldNumber: 2, dataType: "uint64" },
        startBlockHeight: { fieldNumber: 3, dataType: "uint64" },
        endBlockHeight: { fieldNumber: 4, dataType: "uint64" },
        width: { fieldNumber: 5, dataType: "uint32" },
        height: { fieldNumber: 6, dataType: "uint32" },
        timeBetweenDraws: { fieldNumber: 7, dataType: "uint32" },
        state: { fieldNumber: 8, dataType: "uint32", default: CanvasState.PENDING },
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
    state: number;
}
