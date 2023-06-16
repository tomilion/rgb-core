import { ReducerHandler } from "lisk-framework/dist-node/types";
import { codec, testing } from "lisk-sdk";
import { Account } from "@liskhq/lisk-chain/dist-node/types";
import { when } from "jest-when";
import { DrawPixelAsset } from "../../../../../src/app/modules/canvas/assets/draw_pixel_asset";
import { CanvasModule } from "../../../../../src/app/modules/canvas/canvas_module";
import { accountSchema, CanvasPayload, canvasSchema, CanvasState, DrawPixelPayload } from "../../../../../src/app/modules/canvas/schemas";
import { numberBetween, randomCanvas, randomCoordinate, randomDrawPixel } from "../../../../utils/random_generator";

describe("DrawPixelAsset", () => {
    let mockAsset: DrawPixelPayload;
    let testClass: DrawPixelAsset;

    beforeEach(() => {
        mockAsset = randomDrawPixel();
        testClass = new DrawPixelAsset();
    });

    describe("constructor", () => {
        it("should have valid id", () => {
            expect(testClass.id).toEqual(5);
        });

        it("should have valid name", () => {
            expect(testClass.name).toEqual("drawPixel");
        });

        it("should have valid schema", () => {
            expect(testClass.schema).toMatchSnapshot();
        });
    });

    describe("validate", () => {
        it("should pass with valid args", () => {
            const context = testing.createValidateAssetContext({
                asset: mockAsset,
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            testClass.validate(context);
        });

        it("should throw no colours provided", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, colours: new Uint8Array(0) },
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Requires at least 1 colour");
        });

        it("should throw too many colours provided", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, colours: new Uint8Array(51) },
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Exceeded maximum number of colours");
        });

        it("should throw coords do not fit multiple of 24 bit", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, coords: new Uint8Array(4) },
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Coords invalid");
        });

        it("should throw not enough coords for colours", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, coords: new Uint8Array(9), colours: new Uint8Array(3) },
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Number of coords does not match number of colours");
        });

        it("should throw not enough colours for coords", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, coords: new Uint8Array(9), colours: new Uint8Array(1) },
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Number of coords does not match number of colours");
        });
    });

    describe("apply", () => {
        let account: Account;
        let chain: any;
        let canvas: CanvasPayload;
        let reducerHandler: ReducerHandler;

        beforeEach(() => {
            account = testing.fixtures.createDefaultAccount([CanvasModule]);
            chain = {};
            canvas = randomCanvas({
                width: 1000,
                height: 1000,
                timeBetweenDraws: numberBetween(1, 900),
            });
            reducerHandler = testing.mocks.reducerHandlerMock;
        });

        it("should update existing canvas account in state store", async () => {
            const height = numberBetween(canvas.timeBetweenDraws, canvas.timeBetweenDraws + 100000);
            const lastBlockHeaders = [{ height: height - 1 }, { height: height }];

            mockAsset.coords = new Uint8Array(randomCoordinate(canvas.width, canvas.height));
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, canvas);
            chain[`canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`] = codec.encode(accountSchema, {
                lastBlockHeight: height - canvas.timeBetweenDraws
            });

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain,
                lastBlockHeaders,
            });
            const context = testing.createApplyAssetContext({
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
                asset: mockAsset,
                reducerHandler,
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, "set");
            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getLastBlockHeight").mockResolvedValue(height);

            await testClass.apply(context);

            expect(setMock).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`,
                codec.encode(accountSchema, { lastBlockHeight: height + 1 })
            );
        });

        it("should allow multiples draws to same block with timeBetweenDraws of zero", async () => {
            const height = numberBetween(100, 100000);
            const lastBlockHeaders = [{ height: height - 1 }, { height: height }];
            canvas.timeBetweenDraws = 0;

            mockAsset.coords = new Uint8Array(randomCoordinate(canvas.width, canvas.height));
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, canvas);
            chain[`canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`] = codec.encode(accountSchema, {
                lastBlockHeight: height + 1
            });

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain,
                lastBlockHeaders,
            });
            const context = testing.createApplyAssetContext({
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
                asset: mockAsset,
                reducerHandler,
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, "set");
            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getLastBlockHeight").mockResolvedValue(height);

            await testClass.apply(context);

            expect(setMock).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`,
                codec.encode(accountSchema, { lastBlockHeight: height + 1 })
            );
        });

        it("should throw canvas does not exist", async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
                asset: mockAsset,
                reducerHandler,
                stateStore
            });

            await expect(testClass.apply(context)).rejects.toThrow("Canvas does not exist");
        });

        it("should throw canvas not active", async () => {
            canvas.state = CanvasState.COMPLETE;
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, canvas);

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
                asset: mockAsset,
                reducerHandler,
                stateStore
            });

            await expect(testClass.apply(context)).rejects.toThrow("Canvas not active");
        });

        it("should throw coords out of bounds", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, canvas);
            const coord = canvas.width * canvas.height;
            mockAsset.coords = new Uint8Array([coord & 0xFF, (coord >> 8) & 0xFF, (coord >> 16) & 0xFF]);

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
                asset: mockAsset,
                reducerHandler,
                stateStore
            });

            await expect(testClass.apply(context)).rejects.toThrow("Coords invalid");
        });

        it("should throw user not waited for draw timeout", async () => {
            const height = numberBetween(canvas.timeBetweenDraws, canvas.timeBetweenDraws + 100000);
            const lastBlockHeaders = [{ height: height - 1 }, { height: height }];

            mockAsset.coords = new Uint8Array(randomCoordinate(canvas.width, canvas.height));
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, canvas);
            chain[`canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`] = codec.encode(accountSchema, {
                lastBlockHeight: height - canvas.timeBetweenDraws + 2
            });

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain,
                lastBlockHeaders
            });
            const context = testing.createApplyAssetContext({
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
                asset: mockAsset,
                reducerHandler,
                stateStore
            });
            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getLastBlockHeight").mockResolvedValue(height);

            await expect(testClass.apply(context)).rejects.toThrow("Too many draws");
        });
    });
});
