import { ReducerHandler } from "lisk-framework/dist-node/types";
import { codec, testing } from "lisk-sdk";
import { Account } from "@liskhq/lisk-chain/dist-node/types";
import { when } from "jest-when";
import { DrawPixelAsset, DrawPixelPayload } from '../../../../../src/app/modules/canvas/assets/draw_pixel_asset';
import { CanvasModule } from "../../../../../src/app/modules/canvas/canvas_module";
import { accountSchema, CanvasPayload, canvasSchema, CanvasState } from "../../../../../src/app/modules/canvas/schemas";
import { numberBetween, randomCanvas } from "../../../../utils/random_generator";

describe('DrawPixelAsset', () => {
    let mockAsset: DrawPixelPayload;
    let testClass: DrawPixelAsset;

    beforeEach(() => {
        mockAsset = {
            canvasId: numberBetween(0, 4294967295),
            coords: numberBetween(0, 999999),
            colour: numberBetween(0, 0xFFFFFF),
        };
        testClass = new DrawPixelAsset();
    });

    describe('constructor', () => {
        it('should have valid id', () => {
            expect(testClass.id).toEqual(5);
        });

        it('should have valid name', () => {
            expect(testClass.name).toEqual('drawPixel');
        });

        it('should have valid schema', () => {
            expect(testClass.schema).toMatchSnapshot();
        });
    });

    describe('validate', () => {
        it('should pass with valid args', () => {
            const context = testing.createValidateAssetContext({
                asset: mockAsset,
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            testClass.validate(context);
        });

        it('should throw coords below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: {...mockAsset, coords: -1},
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Coords invalid');
        });

        it('should throw coords above 10k grid', () => {
            const context = testing.createValidateAssetContext({
                asset: {...mockAsset, coords: 10000 * 10000},
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Coords invalid');
        });

        it('should throw colour below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: {...mockAsset, colour: -1},
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Colour invalid');
        });

        it('should throw colour above max supported encoding', () => {
            const context = testing.createValidateAssetContext({
                asset: {...mockAsset, colour: 0x1000000},
                transaction: { senderAddress: Buffer.alloc(0) } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Colour invalid');
        });
    });

    describe('apply', () => {
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

        it('should update existing canvas account in state store', async () => {
            const x = numberBetween(0, canvas.width - 1);
            const y = numberBetween(0, canvas.height - 1);
            const height = numberBetween(canvas.timeBetweenDraws, canvas.timeBetweenDraws + 100000);
            const lastBlockHeaders = [{ height: height - 1 }, { height: height }];

            mockAsset.coords = x + (y * canvas.height);
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
            const setMock = jest.spyOn(stateStore.chain, 'set');
            const invokeMock = jest.spyOn(reducerHandler, 'invoke');

            when(invokeMock).calledWith("canvas:getLastBlockHeight").mockResolvedValue(height);

            await testClass.apply(context);

            expect(setMock).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`,
                codec.encode(accountSchema, { lastBlockHeight: height + 1 })
            );
        });

        it('should allow multiples draws to same block with timeBetweenDraws of zero', async () => {
            const x = numberBetween(0, canvas.width - 1);
            const y = numberBetween(0, canvas.height - 1);
            const height = numberBetween(100, 100000);
            const lastBlockHeaders = [{ height: height - 1 }, { height: height }];
            canvas.timeBetweenDraws = 0;

            mockAsset.coords = x + (y * canvas.height);
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
            const setMock = jest.spyOn(stateStore.chain, 'set');
            const invokeMock = jest.spyOn(reducerHandler, 'invoke');

            when(invokeMock).calledWith("canvas:getLastBlockHeight").mockResolvedValue(height);

            await testClass.apply(context);

            expect(setMock).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}-account-${account.address.toString("hex")}`,
                codec.encode(accountSchema, { lastBlockHeight: height + 1 })
            );
        });

        it('should throw canvas does not exist', async () => {
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

        it('should throw canvas not active', async () => {
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

        it('should throw coords out of bounds', async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, canvas);
            mockAsset.coords = canvas.width * canvas.height;

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

        it('should throw user not waited for draw timeout', async () => {
            const x = numberBetween(0, canvas.width - 1);
            const y = numberBetween(0, canvas.height - 1);
            const height = numberBetween(canvas.timeBetweenDraws, canvas.timeBetweenDraws + 100000);
            const lastBlockHeaders = [{ height: height - 1 }, { height: height }];

            mockAsset.coords = x + (y * canvas.height);
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
            const invokeMock = jest.spyOn(reducerHandler, 'invoke');

            when(invokeMock).calledWith("canvas:getLastBlockHeight").mockResolvedValue(height);

            await expect(testClass.apply(context)).rejects.toThrow("Too many draws");
        });
    });
});
