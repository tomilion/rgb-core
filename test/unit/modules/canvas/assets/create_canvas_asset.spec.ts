import { codec, testing } from 'lisk-sdk';
import { CreateCanvasAsset, CreateCanvasPayload } from '../../../../../src/app/modules/canvas/assets/create_canvas_asset';
import { CanvasModule } from "../../../../../src/app/modules/canvas/canvas_module";
import { canvasSchema, pendingSchema } from "../../../../../src/app/modules/canvas/schemas";
import { now, numberBetween, randomAddress } from "../../../../utils/random_generator";

describe('CreateCanvasAsset', () => {
    let mockUser: Buffer;
    let mockAsset: CreateCanvasPayload;
    let testClass: CreateCanvasAsset;

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
        testClass = new CreateCanvasAsset(mockUser.toString("hex"));
    });

    describe('constructor', () => {
        it('should have valid id', () => {
            expect(testClass.id).toEqual(0);
        });

        it('should have valid name', () => {
            expect(testClass.name).toEqual('createCanvas');
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

        it('should throw for invalid user', () => {
            const context = testing.createValidateAssetContext({
                asset: mockAsset,
                transaction: { senderAddress: randomAddress() } as any,
            });
            expect(() => testClass.validate(context)).toThrow('User invalid');
        });

        it('should throw width below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, width: -1},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Width invalid');
        });

        it('should throw width above 10000', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, width: 10001},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Width invalid');
        });

        it('should throw height below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, height: -1},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Height invalid');
        });

        it('should throw height above 10000', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, height: 10001},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Height invalid');
        });

        it('should throw cost per pixel below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, costPerPixel: BigInt(-1)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Cost per pixel invalid');
        });

        it('should throw seed below 0', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, seed: BigInt(-1)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Seed invalid');
        });

        it('should throw start time in past', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startTime: now() - BigInt(1), endTime: now() + BigInt(10000)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('Start time cannot be in the past');
        });

        it('should throw end time in past', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startTime: now() + BigInt(10000), endTime: now() - BigInt(1)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('End time cannot be in the past');
        });

        it('should throw start time above end time', () => {
            const context = testing.createValidateAssetContext({
                asset: { ...mockAsset, startTime: now() + BigInt(10001), endTime: now() + BigInt(10000)},
                transaction: { senderAddress: mockUser } as any,
            });
            expect(() => testClass.validate(context)).toThrow('End time must be greater than start time');
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
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
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
                })
            );
            expect(stateStore.chain.set).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, {
                    canvasIds: [mockAsset.canvasId],
                })
            );
        });

        it('should append canvas id to existing pending array', async () => {
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
                })
            );
            expect(stateStore.chain.set).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, {
                    canvasIds: pending.concat(mockAsset.canvasId),
                })
            );
        });

        it('should throw canvas exists', async () => {
            chain[`canvas-${mockAsset.canvasId}`] = codec.encode(canvasSchema, {
                ownerId: account.address,
                costPerPixel: mockAsset.costPerPixel,
                startTime: mockAsset.startTime,
                endTime: mockAsset.endTime,
                width: mockAsset.width,
                height: mockAsset.height,
                timeBetweenDraws: mockAsset.timeBetweenDraws,
                seed: mockAsset.seed,
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

            await expect(testClass.apply(context)).rejects.toThrow("Canvas already exists");
        });
    });
});
