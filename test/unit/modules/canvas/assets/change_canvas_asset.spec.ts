import { codec, testing } from 'lisk-sdk';
import { ChangeCanvasAsset, ChangeCanvasPayload } from '../../../../../src/app/modules/canvas/assets/change_canvas_asset';
import { CanvasModule } from "../../../../../src/app/modules/canvas/canvas_module";
import { canvasSchema, CanvasState } from "../../../../../src/app/modules/canvas/schemas";
import { numberBetween, now, randomCanvas, randomAddress } from "../../../../utils/random_generator";

describe('ChangeCanvasAsset', () => {
    let mockUser: Buffer;
    let mockAsset: ChangeCanvasPayload;
    let testClass: ChangeCanvasAsset;

    beforeEach(() => {
        mockUser = randomAddress();
        mockAsset = {
            canvasId: numberBetween(0, 4294967295),
            costPerPixel: BigInt(numberBetween(0, 4294967295)),
            startTime: now() + BigInt(numberBetween(0, 604800)),
            endTime: now() + BigInt(numberBetween(1209600, 1814400)),
            width: numberBetween(0, 10000),
            height: numberBetween(0, 10000),
            timeBetweenDraws: numberBetween(0, 4294967295),
            seed: BigInt(numberBetween(0, Number.MAX_SAFE_INTEGER)),
        };
        testClass = new ChangeCanvasAsset();
    });

    describe('constructor', () => {
        it('should have valid id', () => {
            expect(testClass.id).toEqual(1);
        });

        it('should have valid name', () => {
            expect(testClass.name).toEqual('changeCanvas');
        });

        it('should have valid schema', () => {
            expect(testClass.schema).toMatchSnapshot();
        });
    });

    describe('validate', () => {
        it('should pass with valid args', () => {
            const context = testing.createValidateAssetContext({
                asset: mockAsset,
                transaction: { senderAddress: mockUser } as any,
            });
            testClass.validate(context);
        });

        it('should throw width below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, width: -1 },
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Width invalid');
        });

        it('should throw width above 10000', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, width: 10001},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Width invalid');
        });

        it('should throw height below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, height: -1},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Height invalid');
        });

        it('should throw height above 10000', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, height: 10001},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Height invalid');
        });

        it('should throw cost per pixel below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, costPerPixel: BigInt(-1)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Cost per pixel invalid');
        });

        it('should throw seed below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, seed: BigInt(-1)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Seed invalid');
        });

        it('should throw start time in past', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, startTime: now() - BigInt(1), endTime: now() + BigInt(10000)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Start time cannot be in the past');
        });

        it('should throw end time in past', () => {
            const context = testing.createValidateAssetContext({
                asset: { canvasId: mockAsset.canvasId, startTime: now() + BigInt(10000), endTime: now() - BigInt(1)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('End time cannot be in the past');
        });
    });

    describe('apply', () => {
        let account: any;
        let chain: any;

        beforeEach(() => {
            account = testing.fixtures.createDefaultAccount([CanvasModule]);
            chain = {};
        });

        it('should save canvas to state store', async () => {
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
            jest.spyOn(stateStore.chain, 'set');

            await testClass.apply(context);

            expect(stateStore.chain.set).toHaveBeenCalledWith(
                `canvas-${mockAsset.canvasId}`,
                codec.encode(canvasSchema, {
                    ownerId: account.address,
                    costPerPixel: mockAsset.costPerPixel,
                    startTime: mockAsset.startTime,
                    endTime: mockAsset.endTime,
                    width: mockAsset.width,
                    height: mockAsset.height,
                    timeBetweenDraws: mockAsset.timeBetweenDraws,
                    seed: mockAsset.seed,
                    state: CanvasState.PENDING,
                })
            );
        });

        it('should throw canvas does not exist', async () => {
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

        it('should throw for invalid user', async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                startTime: mockAsset.startTime,
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

        it('should throw start time above end time', async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                startTime: mockAsset.startTime,
                state: CanvasState.PENDING,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: { canvasId: mockAsset.canvasId, endTime: (mockAsset.startTime ?? BigInt(Number.MAX_SAFE_INTEGER)) - BigInt(1) },
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow('End time must be greater than start time');
        });

        it('should throw canvas already ended above start time', async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                endTime: now() - BigInt(1),
                state: CanvasState.PENDING,
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

            await expect(testClass.apply(context)).rejects.toThrow('Canvas already ended');
        });

        it('should throw canvas already ended completed', async () => {
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

            await expect(testClass.apply(context)).rejects.toThrow('Canvas already ended');
        });

        it('should throw canvas already started above end time', async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, randomCanvas({
                ownerId: account.address,
                startTime: now() - BigInt(1),
                state: CanvasState.PENDING,
            }));
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createApplyAssetContext({
                stateStore,
                asset: {canvasId: mockAsset.canvasId, endTime: (mockAsset.startTime ?? BigInt(Number.MAX_SAFE_INTEGER)) - BigInt(1)},
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow('Canvas already started');
        });

        it('should throw canvas already started active', async () => {
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
                asset: {canvasId: mockAsset.canvasId, endTime: (mockAsset.startTime ?? BigInt(Number.MAX_SAFE_INTEGER)) - BigInt(1)},
                transaction: { senderAddress: account.address, nonce: BigInt(1) } as any,
            });

            await expect(testClass.apply(context)).rejects.toThrow('Canvas already started');
        });
    });
});
