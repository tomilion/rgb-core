import { Block, Transaction } from "@liskhq/lisk-chain";
import { CanvasPayload, CanvasState, DrawPixelPayload } from "../../src/app/modules/canvas/schemas";

export const numberBetween = (lower: number, upper: number): number => lower + Math.floor(Math.random() * (upper - lower));

export const randomBuffer = (length: number): Buffer => {
    const result: number[] = [];

    for (let i = 0; i < length; i += 1) {
        result.push(numberBetween(0, 255));
    }

    return Buffer.from(result);
};

export const randomAddress = (): Buffer => randomBuffer(20);

export const randomCanvas = (overwrite = {}): CanvasPayload => {
    return {
        ownerId: randomAddress(),
        costPerPixel: BigInt(numberBetween(0, 4294967295)),
        startBlockHeight: BigInt(numberBetween(0, 1000000)),
        endBlockHeight: BigInt(numberBetween(1000001, 2000000)),
        width: numberBetween(0, 10000),
        height: numberBetween(0, 10000),
        timeBetweenDraws: numberBetween(0, 4294967295),
        state: CanvasState.ACTIVE,
        ...overwrite,
    };
};

export const randomDrawPixel = (overwrite = {}): DrawPixelPayload => {
    return {
        canvasId: numberBetween(0, 10000),
        coords: new Uint8Array(randomCoordinate(1000, 1000)),
        colours: new Uint8Array([numberBetween(0, 0xF)]),
        ...overwrite,
    };
};

export const randomCoordinate = (width: number, height: number): number[] => {
    const x = numberBetween(0, width - 1);
    const y = numberBetween(0, height - 1);
    const coord = x + (y * height);
    return [coord & 0xFF, (coord >> 8) & 0xFF, (coord >> 16) & 0xFF];
};

export const randomBlock = (overwriteHeader = {}, payload: Transaction[] = []): Block => {
    return {
        header: {
            id: randomBuffer(20),
            version: numberBetween(0, 4294967295),
            timestamp: numberBetween(0, 4294967295),
            height: numberBetween(0, 4294967295),
            previousBlockID: randomBuffer(20),
            transactionRoot: randomBuffer(20),
            generatorPublicKey: randomBuffer(20),
            reward: BigInt(numberBetween(0, Number.MAX_SAFE_INTEGER)),
            signature: randomBuffer(20),
            asset: {
                seedReveal: randomBuffer(20),
                maxHeightPreviouslyForged: numberBetween(0, 4294967295),
                maxHeightPrevoted: numberBetween(0, 4294967295),
            },
            ...overwriteHeader,
        },
        payload,
    };
};

export const randomTransaction = (overwrite = {}): Transaction => {
    return new Transaction({
        moduleID: numberBetween(100000, 1000000),
        assetID: numberBetween(100000, 1000000),
        senderPublicKey: randomBuffer(10),
        nonce: BigInt(numberBetween(100000, 1000000)),
        fee: BigInt(numberBetween(100000, 1000000)),
        asset: randomBuffer(10),
        signatures: [randomBuffer(10)],
        ...overwrite
    });
};
