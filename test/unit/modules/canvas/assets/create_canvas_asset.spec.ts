import { codec, testing } from "lisk-sdk";
import { CreateCanvasAsset } from "../../../../../src/app/modules/canvas/assets/create_canvas_asset";
import { CanvasModule } from "../../../../../src/app/modules/canvas/canvas_module";
import { canvasSchema, CreateCanvasPayload, pendingSchema } from "../../../../../src/app/modules/canvas/schemas";
import { numberBetween, randomAddress } from "../../../../utils/random_generator";
import { ReducerHandler } from "lisk-framework/dist-node/types";
import { when } from "jest-when";

describe("CreateCanvasAsset", () => {
    let mockAsset: CreateCanvasPayload;
    let testClass: CreateCanvasAsset;

    beforeEach(() => {
        mockAsset = {
            canvasId: numberBetween(0, 4294967295),
            costPerPixel: BigInt(numberBetween(0, 4294967295)),
            startBlockHeight: BigInt(numberBetween(0, 1000000)),
            endBlockHeight: BigInt(numberBetween(1000001, 2000000)),
            width: numberBetween(0, 10000),
            height: numberBetween(0, 10000),
            timeBetweenDraws: numberBetween(0, 4294967295),
            maxPixelsPerTransaction: numberBetween(1, 10000),
            colourPalette: Buffer.from(new Uint8Array(48)),
        };
        testClass = new CreateCanvasAsset();
    });

    describe("constructor", () => {
        it("should have valid id", () => {
            expect(testClass.id).toEqual(0);
        });

        it("should have valid name", () => {
            expect(testClass.name).toEqual("createCanvas");
        });

        it("should have valid schema", () => {
            expect(testClass.schema).toMatchSnapshot();
        });
    });

    describe("validate", () => {
        it("should pass with valid args", () => {
            const context = testing.createValidateAssetContext({
                asset: mockAsset,
                transaction: { } as any,
            });
            testClass.validate(context);
        });

        it("should throw width below 0", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, width: 0 },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Width invalid");
        });

        it("should throw width above 10000", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, width: 10001 },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Width invalid");
        });

        it("should throw height below 0", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, height: 0 },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Height invalid");
        });

        it("should throw height above 10000", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, height: 10001 },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Height invalid");
        });

        it("should throw cost per pixel below 0", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, costPerPixel: BigInt(-1) },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Cost per pixel invalid");
        });

        it("should throw start block height in past", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startBlockHeight: BigInt(10000), endBlockHeight: BigInt(20000) },
                transaction: { } as any,
            });
            context.header = { height: 10001 } as any;
            expect(() => testClass.validate(context)).toThrow("Start block height cannot be in the past");
        });

        it("should throw end block height in past", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startBlockHeight: BigInt(20000), endBlockHeight: BigInt(10000) },
                transaction: { } as any,
            });
            context.header = { height: 10001 } as any;
            expect(() => testClass.validate(context)).toThrow("End block height cannot be in the past");
        });

        it("should throw start block height above end block height", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startBlockHeight: BigInt(10001), endBlockHeight: BigInt(10000) },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("End block height must be greater than start block height");
        });

        it("should throw max pixels per transaction below 1", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, maxPixelsPerTransaction: 0 },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Max pixels per transaction invalid");
        });

        it("should throw max pixels per transaction above 10000", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, maxPixelsPerTransaction: 10001 },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Max pixels per transaction invalid");
        });

        it("should throw invalid colour palette size", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, colourPalette: Buffer.from(new Uint8Array(47)) },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Colour palette invalid");
        });
    });

    describe("apply", () => {
        let account: any;
        let chain: any;
        let reducerHandler: ReducerHandler;

        beforeEach(() => {
            account = testing.fixtures.createDefaultAccount([CanvasModule]);
            chain = {};
            reducerHandler = testing.mocks.reducerHandlerMock;
        });

        it("should throw for invalid user", async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: mockAsset,
                reducerHandler,
                transaction: { senderAddress: randomAddress(), nonce: BigInt(1) } as any,
            });

            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getAdminAddress").mockResolvedValue(randomAddress());

            await expect(testClass.apply(context)).rejects.toThrow("User invalid");
        });

        it("should save canvas to state store", async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: mockAsset,
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });
            jest.spyOn(stateStore.chain, "set");

            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getAdminAddress").mockResolvedValue(account.address);

            await testClass.apply(context);

            expect(stateStore.chain.set).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}`,
                codec.encode(canvasSchema, {
                    ownerId: account.address,
                    costPerPixel: mockAsset.costPerPixel,
                    startBlockHeight: mockAsset.startBlockHeight,
                    endBlockHeight: mockAsset.endBlockHeight,
                    width: mockAsset.width,
                    height: mockAsset.height,
                    timeBetweenDraws: mockAsset.timeBetweenDraws,
                    colourPalette: mockAsset.colourPalette,
                    maxPixelsPerTransaction: mockAsset.maxPixelsPerTransaction,
                })
            );
            expect(stateStore.chain.set).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, {
                    canvasIds: [mockAsset.canvasId],
                })
            );
        });

        it("should append canvas id to existing pending array", async () => {
            const pending = [numberBetween(0, 4294967295), numberBetween(0, 4294967295), numberBetween(0, 4294967295)];
            chain["canvas:pending"] = codec.encode(pendingSchema, {
                canvasIds: pending,
            });
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: mockAsset,
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });
            jest.spyOn(stateStore.chain, "set");

            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getAdminAddress").mockResolvedValue(account.address);

            await testClass.apply(context);

            expect(stateStore.chain.set).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}`,
                codec.encode(canvasSchema, {
                    ownerId: account.address,
                    costPerPixel: mockAsset.costPerPixel,
                    startBlockHeight: mockAsset.startBlockHeight,
                    endBlockHeight: mockAsset.endBlockHeight,
                    width: mockAsset.width,
                    height: mockAsset.height,
                    timeBetweenDraws: mockAsset.timeBetweenDraws,
                    colourPalette: mockAsset.colourPalette,
                    maxPixelsPerTransaction: mockAsset.maxPixelsPerTransaction,
                })
            );
            expect(stateStore.chain.set).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, {
                    canvasIds: pending.concat(mockAsset.canvasId),
                })
            );
        });

        it("should throw canvas exists", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, {
                ownerId: account.address,
                costPerPixel: mockAsset.costPerPixel,
                startBlockHeight: mockAsset.startBlockHeight,
                endBlockHeight: mockAsset.endBlockHeight,
                width: mockAsset.width,
                height: mockAsset.height,
                timeBetweenDraws: mockAsset.timeBetweenDraws,
            });
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: mockAsset,
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            const invokeMock = jest.spyOn(reducerHandler, "invoke");

            when(invokeMock).calledWith("canvas:getAdminAddress").mockResolvedValue(account.address);

            await expect(testClass.apply(context)).rejects.toThrow("Canvas already exists");
        });
    });
});
