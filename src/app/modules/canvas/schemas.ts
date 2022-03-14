export enum CanvasState {
    PENDING = 0,
    ACTIVE = 1,
    COMPLETE = 2,
}

export interface CanvasPayload {
    ownerId: Buffer;
    costPerPixel: bigint;
    startTime: bigint;
    endTime: bigint;
    width: number;
    height: number;
    timeBetweenDraws: number;
    seed: bigint;
    state: number;
}

export const canvasSchema = {
    $id: "canvas/canvas",
    type: "object",
    required: ["ownerId", "costPerPixel", "startTime", "endTime", "width", "height", "timeBetweenDraws", "seed"],
    properties: {
        ownerId: { fieldNumber: 1, dataType: "bytes", minLength: 20, maxLength: 20 },
        costPerPixel: { fieldNumber: 2, dataType: "uint64" },
        startTime: { fieldNumber: 3, dataType: "uint64" },
        endTime: { fieldNumber: 4, dataType: "uint64" },
        width: { fieldNumber: 5, dataType: "uint32" },
        height: { fieldNumber: 6, dataType: "uint32" },
        timeBetweenDraws: { fieldNumber: 7, dataType: "uint32" },
        seed: { fieldNumber: 8, dataType: "uint64" },
        state: { fieldNumber: 9, dataType: "uint32", default: CanvasState.PENDING },
    },
};

export interface PixelPayload {
    ownerId: Buffer;
    colour: number;
}

export const pixelSchema = {
    $id: "canvas/pixel",
    type: "object",
    required: ["ownerId", "colour"],
    properties: {
        ownerId: { fieldNumber: 1, dataType: "bytes", minLength: 20, maxLength: 20 },
        colour: { fieldNumber: 2, dataType: "uint32" },
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
