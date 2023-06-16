import { codec, testing } from "lisk-sdk";
import { ChangeCanvasAsset } from "../../../../../src/app/modules/canvas/assets/change_canvas_asset";
import { CanvasModule } from "../../../../../src/app/modules/canvas/canvas_module";
import { canvasSchema, CanvasState, ChangeCanvasPayload } from "../../../../../src/app/modules/canvas/schemas";
import { numberBetween, randomCanvas, randomAddress } from "../../../../utils/random_generator";

describe("ChangeCanvasAsset", () => {
    let mockUser: Buffer;
    let mockAsset: ChangeCanvasPayload;
    let testClass: ChangeCanvasAsset;

    beforeEach(() => {
        mockUser = randomAddress();
        mockAsset = {
            canvasId: numberBetween(0, 4294967295),
            costPerPixel: BigInt(numberBetween(0, 4294967295)),
            startBlockHeight: BigInt(numberBetween(0, 1000000)),
            endBlockHeight: BigInt(numberBetween(1000001, 2000000)),
            width: numberBetween(0, 10000),
            height: numberBetween(0, 10000),
            timeBetweenDraws: numberBetween(0, 4294967295),
            colourPalette: new Uint8Array(48),
        };
        testClass = new ChangeCanvasAsset();
    });

    describe("constructor", () => {
        it("should have valid id", () => {
            expect(testClass.id).toEqual(1);
        });

        it("should have valid name", () => {
            expect(testClass.name).toEqual("changeCanvas");
        });

        it("should have valid schema", () => {
            expect(testClass.schema).toMatchSnapshot();
        });
    });

    describe("validate", () => {
        it("should pass with valid args", () => {
            const context = testing.createValidateAssetContext({
                asset: mockAsset,
                transaction: { senderAddress: mockUser } as any,
            });
            testClass.validate(context);
        });

        it("should throw width below 0", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, width: -1 },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Width invalid");
        });

        it("should throw width above 10000", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, width: 10001 },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Width invalid");
        });

        it("should throw height below 0", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, height: -1 },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Height invalid");
        });

        it("should throw height above 10000", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, height: 10001 },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Height invalid");
        });

        it("should throw cost per pixel below 0", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, costPerPixel: BigInt(-1) },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Cost per pixel invalid");
        });

        it("should throw start block height in past", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, startBlockHeight: BigInt(10000) },
                transaction: { senderAddress: mockUser } as any,
            });
            context.header = { height: 10001 } as any;
            expect(() => testClass.validate(context)).toThrow("Start block height cannot be in the past");
        });

        it("should throw end block height in past", () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, endBlockHeight: BigInt(10000) },
                transaction: { senderAddress: mockUser } as any,
            });
            context.header = { height: 10001 } as any;
            expect(() => testClass.validate(context)).toThrow("End block height cannot be in the past");
        });

        it("should throw start block height above end block height", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startBlockHeight: BigInt(10001), endBlockHeight: BigInt(10000) },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow("End block height must be greater than start block height");
        });

        it("should throw invalid colour palette size", () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, colourPalette: new Uint8Array(47) },
                transaction: { } as any,
            });
            expect(() => testClass.validate(context)).toThrow("Colour palette invalid");
        });
    });

    describe("apply", () => {
        let account: any;
        let chain: any;

        beforeEach(() => {
            account = testing.fixtures.createDefaultAccount([CanvasModule]);
            chain = {};
        });

        it("should save canvas to state store", async () => {
            const currentAsset = randomCanvas({ ownerId: account.address, state: CanvasState.PENDING });
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, currentAsset);
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
                    state: CanvasState.PENDING,
                })
            );
        });

        it("should throw canvas does not exist", async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: mockAsset,
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("Canvas does not exist");
        });

        it("should throw for invalid user", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                startBlockHeight: mockAsset.startBlockHeight,
                state: CanvasState.PENDING,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId },
                transaction: { senderAddress: randomAddress(), nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("User invalid");
        });

        it("should throw start block height above end block height", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                startBlockHeight: mockAsset.startBlockHeight,
                state: CanvasState.PENDING,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId, endBlockHeight: (mockAsset.startBlockHeight ?? BigInt(Number.MAX_SAFE_INTEGER)) - BigInt(1) },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("End block height must be greater than start block height");
        });

        it("should throw canvas already completed", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                state: CanvasState.COMPLETE,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("Canvas already completed");
        });

        it("should throw canvas already started modify start block height", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                state: CanvasState.ACTIVE,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId, startBlockHeight: BigInt(1) },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("Cannot modify start block height on active canvas");
        });

        it("should throw canvas already started modify end block height", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                state: CanvasState.ACTIVE,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId, endBlockHeight: BigInt(1) },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("Cannot modify end block height on active canvas");
        });

        it("should throw start block height above end block height (existing start block height)", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                startBlockHeight: BigInt(100),
                state: CanvasState.PENDING,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId, endBlockHeight: BigInt(99) },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("End block height must be greater than start block height");
        });

        it("should throw start block height above end block height (existing end block height)", async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                endBlockHeight: BigInt(100),
                state: CanvasState.PENDING,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId, startBlockHeight: BigInt(101) },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow("End block height must be greater than start block height");
        });
    });
});
