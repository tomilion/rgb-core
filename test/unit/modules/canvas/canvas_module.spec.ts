import { codec, testing } from "lisk-sdk";
import { Account } from "@liskhq/lisk-chain/dist-node/types";
import { CanvasModule } from '../../../../src/app/modules/canvas/canvas_module';
import { ActivePayload, activeSchema, canvasSchema, CanvasState, CompletePayload, completeSchema, PendingPayload, pendingSchema, pixelSchema } from "../../../../src/app/modules/canvas/schemas";
import { now, numberBetween, randomAddress, randomBlock, randomCanvas } from "../../../utils/random_generator";

describe('CanvasModuleModule', () => {
    let testClass: CanvasModule;

    beforeEach(() => {
        testClass = new CanvasModule(testing.fixtures.defaultConfig.genesisConfig);
    });

    describe('constructor', () => {
        it('should have valid id', () => {
            expect(testClass.id).toEqual(1000);
        });

        it('should have valid name', () => {
            expect(testClass.name).toEqual('canvas');
        });
    });

    describe('actions', () => {
        let chain: any;

        beforeEach(() => {
            chain = {};
        });

        describe('getCanvas', () => {
            it('should return canvas', async () => {
                const canvasId = numberBetween(0, 4294967295);
                const canvas = randomCanvas();

                chain[`canvas-${canvasId}`] = codec.encode(canvasSchema, canvas);

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getCanvas({ canvasId });

                const expected = {
                    ...canvas,
                    ownerId: canvas.ownerId.toString("hex"),
                    costPerPixel: Number(canvas.costPerPixel),
                    startTime: Number(canvas.startTime),
                    endTime: Number(canvas.endTime),
                    seed: Number(canvas.seed),
                };
                expect(result).toEqual(expected);
            });

            it('should return nothing if no canvas with id', async () => {
                const canvasId = numberBetween(0, 4294967295);
                const canvas = randomCanvas();

                chain[`canvas-${canvasId}`] = codec.encode(canvasSchema, canvas);

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getCanvas({ canvasId: numberBetween(0, 4294967295) });

                expect(result).toBeNull();
            });
        });

        describe('getPixels', () => {
            it('should return pixels', async () => {
                const canvasId = numberBetween(0, 4294967295);
                const canvas = randomCanvas({ width: 100, height: 50 });
                const expected: number[][] = Array.from(Array(canvas.height), () => []);

                chain[`canvas-${canvasId}`] = codec.encode(canvasSchema, canvas);

                for (let y = 0; y < canvas.height; y += 1)
                {
                    for (let x = 0; x < canvas.width; x += 1)
                    {
                        const colour = numberBetween(0, 0xFFFFFF);
                        chain[`canvas-${canvasId}-pixel-${x}-${y}`] = codec.encode(pixelSchema, { ownerId: randomAddress(), colour });
                        expected[y][x] = colour;
                    }
                }

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getPixels({ canvasId });

                expect(result).toEqual(expected);
            });

            it('should default pixels to white if not defined', async () => {
                const canvasId = numberBetween(0, 4294967295);
                const canvas = randomCanvas({ width: 100, height: 50 });

                chain[`canvas-${canvasId}`] = codec.encode(canvasSchema, canvas);

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getPixels({ canvasId });

                const expected = new Array(canvas.height).fill(new Array(canvas.width).fill(0xFFFFFF));
                expect(result).toEqual(expected);
            });

            it('should return nothing if no canvas with id', async () => {
                const canvasId = numberBetween(0, 4294967295);
                const canvas = randomCanvas();

                chain[`canvas-${canvasId}`] = codec.encode(canvasSchema, canvas);

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getPixels({ canvasId: numberBetween(0, 4294967295) });

                expect(result).toBeNull();
            });
        });
    });

    describe('afterBlockApply', () => {
        let account: Account;
        let chain: any;
        let pending: PendingPayload;
        let active: ActivePayload;
        let complete: CompletePayload;

        beforeEach(() => {
            account = testing.fixtures.createDefaultAccount([CanvasModule]);
            chain = {};
            pending = { canvasIds: [
                numberBetween(0, 4294967295),
                numberBetween(0, 4294967295),
                numberBetween(0, 4294967295),
            ] };
            active = { canvasIds: [
                numberBetween(0, 4294967295),
                numberBetween(0, 4294967295),
                numberBetween(0, 4294967295),
            ] };
            complete = { canvasIds: [
                numberBetween(0, 4294967295),
                numberBetween(0, 4294967295),
                numberBetween(0, 4294967295),
            ] };
        });

        it('should move pending to active if passed start time', async () => {
            const canvases = [
                randomCanvas({ startTime: now() - BigInt(1), state: CanvasState.PENDING }),
                randomCanvas({ startTime: now() - BigInt(1), state: CanvasState.PENDING }),
                randomCanvas({ state: CanvasState.PENDING }),

                randomCanvas({ state: CanvasState.ACTIVE }),
                randomCanvas({ state: CanvasState.ACTIVE }),
                randomCanvas({ state: CanvasState.ACTIVE }),

                randomCanvas({ state: CanvasState.COMPLETE }),
                randomCanvas({ state: CanvasState.COMPLETE }),
                randomCanvas({ state: CanvasState.COMPLETE }),
            ];

            chain["canvas:pending"] = codec.encode(pendingSchema, pending);
            chain[`canvas-${pending.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[0]);
            chain[`canvas-${pending.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[1]);
            chain[`canvas-${pending.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[2]);

            chain["canvas:active"] = codec.encode(activeSchema, active);
            chain[`canvas-${active.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[3]);
            chain[`canvas-${active.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[4]);
            chain[`canvas-${active.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[5]);

            chain["canvas:complete"] = codec.encode(completeSchema, complete);
            chain[`canvas-${complete.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[6]);
            chain[`canvas-${complete.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[7]);
            chain[`canvas-${complete.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[8]);

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createAfterBlockApplyContext({
                block: randomBlock(),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, 'set');

            await testClass.afterBlockApply(context);

            expect(setMock).toHaveBeenCalledWith(
                `canvas-${pending.canvasIds[0]}`,
                codec.encode(canvasSchema, { ...canvases[0], state: CanvasState.ACTIVE })
            );
            expect(setMock).toHaveBeenCalledWith(
                `canvas-${pending.canvasIds[1]}`,
                codec.encode(canvasSchema, { ...canvases[1], state: CanvasState.ACTIVE })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, { canvasIds: [pending.canvasIds[2]] })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:active",
                codec.encode(activeSchema, { canvasIds: [pending.canvasIds[0], pending.canvasIds[1]].concat(active.canvasIds) })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:complete",
                codec.encode(completeSchema, complete)
            );
        });

        it('should move active to completed if passed end time', async () => {
            const canvases = [
                randomCanvas({ state: CanvasState.PENDING }),
                randomCanvas({ state: CanvasState.PENDING }),
                randomCanvas({ state: CanvasState.PENDING }),

                randomCanvas({ endTime: now() - BigInt(1), state: CanvasState.ACTIVE }),
                randomCanvas({ endTime: now() - BigInt(1), state: CanvasState.ACTIVE }),
                randomCanvas({ state: CanvasState.ACTIVE }),

                randomCanvas({ state: CanvasState.COMPLETE }),
                randomCanvas({ state: CanvasState.COMPLETE }),
                randomCanvas({ state: CanvasState.COMPLETE }),
            ];

            chain["canvas:pending"] = codec.encode(pendingSchema, pending);
            chain[`canvas-${pending.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[0]);
            chain[`canvas-${pending.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[1]);
            chain[`canvas-${pending.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[2]);

            chain["canvas:active"] = codec.encode(activeSchema, active);
            chain[`canvas-${active.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[3]);
            chain[`canvas-${active.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[4]);
            chain[`canvas-${active.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[5]);

            chain["canvas:complete"] = codec.encode(completeSchema, complete);
            chain[`canvas-${complete.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[6]);
            chain[`canvas-${complete.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[7]);
            chain[`canvas-${complete.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[8]);

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createAfterBlockApplyContext({
                block: randomBlock(),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, 'set');

            await testClass.afterBlockApply(context);

            expect(setMock).toHaveBeenCalledWith(
                `canvas-${active.canvasIds[0]}`,
                codec.encode(canvasSchema, { ...canvases[3], state: CanvasState.COMPLETE })
            );
            expect(setMock).toHaveBeenCalledWith(
                `canvas-${active.canvasIds[1]}`,
                codec.encode(canvasSchema, { ...canvases[4], state: CanvasState.COMPLETE })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, pending)
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:active",
                codec.encode(activeSchema, { canvasIds: [active.canvasIds[2]] })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:complete",
                codec.encode(completeSchema, { canvasIds: complete.canvasIds.concat([active.canvasIds[0], active.canvasIds[1]]) })
            );
        });

        it('should do nothing if no times have elapsed', async () => {
            const canvases = [
                randomCanvas({ state: CanvasState.PENDING }),
                randomCanvas({ state: CanvasState.PENDING }),
                randomCanvas({ state: CanvasState.PENDING }),

                randomCanvas({ state: CanvasState.ACTIVE }),
                randomCanvas({ state: CanvasState.ACTIVE }),
                randomCanvas({ state: CanvasState.ACTIVE }),

                randomCanvas({ state: CanvasState.COMPLETE }),
                randomCanvas({ state: CanvasState.COMPLETE }),
                randomCanvas({ state: CanvasState.COMPLETE }),
            ];

            chain["canvas:pending"] = codec.encode(pendingSchema, pending);
            chain[`canvas-${pending.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[0]);
            chain[`canvas-${pending.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[1]);
            chain[`canvas-${pending.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[2]);

            chain["canvas:active"] = codec.encode(activeSchema, active);
            chain[`canvas-${active.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[3]);
            chain[`canvas-${active.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[4]);
            chain[`canvas-${active.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[5]);

            chain["canvas:complete"] = codec.encode(completeSchema, complete);
            chain[`canvas-${complete.canvasIds[0]}`] = codec.encode(canvasSchema, canvases[6]);
            chain[`canvas-${complete.canvasIds[1]}`] = codec.encode(canvasSchema, canvases[7]);
            chain[`canvas-${complete.canvasIds[2]}`] = codec.encode(canvasSchema, canvases[8]);

            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account],
                chain
            });
            const context = testing.createAfterBlockApplyContext({
                block: randomBlock(),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, 'set');

            await testClass.afterBlockApply(context);

            expect(setMock).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, pending)
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:active",
                codec.encode(activeSchema, active)
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:complete",
                codec.encode(completeSchema, complete)
            );
        });

        it('uninitialized', async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
            });
            const context = testing.createAfterBlockApplyContext({
                block: randomBlock(),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, 'set');

            await testClass.afterBlockApply(context);

            expect(setMock).toHaveBeenCalledWith(
                "canvas:pending",
                codec.encode(pendingSchema, { canvasIds: [] })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:active",
                codec.encode(activeSchema, { canvasIds: [] })
            );
            expect(setMock).toHaveBeenCalledWith(
                "canvas:complete",
                codec.encode(completeSchema, { canvasIds: [] })
            );
        });
    });
});
