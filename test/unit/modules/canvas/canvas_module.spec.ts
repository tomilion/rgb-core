import { codec, testing } from "lisk-sdk";
import { Account } from "@liskhq/lisk-chain/dist-node/types";
import { CanvasModule } from "../../../../src/app/modules/canvas/canvas_module";
import { ActivePayload, activeSchema, canvasSchema, CanvasState, CompletePayload, completeSchema, PendingPayload, pendingSchema } from "../../../../src/app/modules/canvas/schemas";
import { numberBetween, randomBlock, randomCanvas, randomDrawPixel, randomTransaction } from "../../../utils/random_generator";
import { DrawPixelAsset, drawPixelSchema } from "../../../../src/app/modules/canvas/assets/draw_pixel_asset";
import { BaseModuleChannel } from "lisk-framework/dist-node/modules/base_module";

describe("CanvasModuleModule", () => {
    let testClass: CanvasModule;

    beforeEach(() => {
        testClass = new CanvasModule(testing.fixtures.defaultConfig.genesisConfig);
    });

    describe("constructor", () => {
        it("should have valid id", () => {
            expect(testClass.id).toEqual(1000);
        });

        it("should have valid name", () => {
            expect(testClass.name).toEqual("canvas");
        });
    });

    describe("actions", () => {
        let chain: any;

        beforeEach(() => {
            chain = {};
        });

        describe("getCanvas", () => {
            it("should return canvas", async () => {
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
                    startBlockHeight: Number(canvas.startBlockHeight),
                    endBlockHeight: Number(canvas.endBlockHeight),
                };
                expect(result).toEqual(expected);
            });

            it("should return nothing if no canvas with id", async () => {
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

        describe("getPendingCanvases", () => {
            it("should return pending canvases", async () => {
                const canvasIds = [
                    numberBetween(0, 4294967295),
                    numberBetween(0, 4294967295),
                    numberBetween(0, 4294967295),
                ];

                chain["canvas:pending"] = codec.encode(pendingSchema, { canvasIds: canvasIds });

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getPendingCanvases();

                const expected = {
                    canvasIds: canvasIds,
                };
                expect(result).toEqual(expected);
            });

            it("should return nothing if no pending canvases", async () => {
                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getPendingCanvases();

                const expected = {
                    canvasIds: [],
                };
                expect(result).toEqual(expected);
            });
        });

        describe("getActiveCanvases", () => {
            it("should return active canvases", async () => {
                const canvasIds = [
                    numberBetween(0, 4294967295),
                    numberBetween(0, 4294967295),
                    numberBetween(0, 4294967295),
                ];

                chain["canvas:active"] = codec.encode(activeSchema, { canvasIds: canvasIds });

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getActiveCanvases();

                const expected = {
                    canvasIds: canvasIds,
                };
                expect(result).toEqual(expected);
            });

            it("should return nothing if no active canvases", async () => {
                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getActiveCanvases();

                const expected = {
                    canvasIds: [],
                };
                expect(result).toEqual(expected);
            });
        });

        describe("getCompleteCanvases", () => {
            it("should return complete canvases", async () => {
                const canvasIds = [
                    numberBetween(0, 4294967295),
                    numberBetween(0, 4294967295),
                    numberBetween(0, 4294967295),
                ];

                chain["canvas:complete"] = codec.encode(completeSchema, { canvasIds: canvasIds });

                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getCompleteCanvases();

                const expected = {
                    canvasIds: canvasIds,
                };
                expect(result).toEqual(expected);
            });

            it("should return nothing if no complete canvases", async () => {
                testClass.init({
                    channel: testing.mocks.channelMock,
                    logger: testing.mocks.loggerMock,
                    dataAccess: new testing.mocks.DataAccessMock({ chainState: chain }),
                });

                const result = await testClass.actions.getCompleteCanvases();

                const expected = {
                    canvasIds: [],
                };
                expect(result).toEqual(expected);
            });
        });
    });

    describe("afterBlockApply", () => {
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

        it("should move pending to active if passed start time", async () => {
            const canvases = [
                randomCanvas({ startBlockHeight: BigInt(150), endBlockHeight: BigInt(250), state: CanvasState.PENDING }),
                randomCanvas({ startBlockHeight: BigInt(150), endBlockHeight: BigInt(250), state: CanvasState.PENDING }),
                randomCanvas({ startBlockHeight: BigInt(151), endBlockHeight: BigInt(250), state: CanvasState.PENDING }),

                randomCanvas({ startBlockHeight: BigInt(100), endBlockHeight: BigInt(151), state: CanvasState.ACTIVE }),
                randomCanvas({ startBlockHeight: BigInt(100), endBlockHeight: BigInt(151), state: CanvasState.ACTIVE }),
                randomCanvas({ startBlockHeight: BigInt(100), endBlockHeight: BigInt(151), state: CanvasState.ACTIVE }),

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
                block: randomBlock({ height: 150 }),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, "set");

            testClass.init({
                channel: testing.mocks.channelMock,
                logger: testing.mocks.loggerMock,
                dataAccess: new testing.mocks.DataAccessMock(),
            });
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

        it("should move active to completed if passed end block height", async () => {
            const canvases = [
                randomCanvas({ startBlockHeight: BigInt(151), endBlockHeight: BigInt(250), state: CanvasState.PENDING }),
                randomCanvas({ startBlockHeight: BigInt(151), endBlockHeight: BigInt(250), state: CanvasState.PENDING }),
                randomCanvas({ startBlockHeight: BigInt(151), endBlockHeight: BigInt(250), state: CanvasState.PENDING }),

                randomCanvas({ startBlockHeight: BigInt(50), endBlockHeight: BigInt(150), state: CanvasState.ACTIVE }),
                randomCanvas({ startBlockHeight: BigInt(50), endBlockHeight: BigInt(150), state: CanvasState.ACTIVE }),
                randomCanvas({ startBlockHeight: BigInt(50), endBlockHeight: BigInt(151), state: CanvasState.ACTIVE }),

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
                block: randomBlock({ height: 150 }),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, "set");

            testClass.init({
                channel: testing.mocks.channelMock,
                logger: testing.mocks.loggerMock,
                dataAccess: new testing.mocks.DataAccessMock(),
            });
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

        it("should do nothing if no times have elapsed", async () => {
            const canvases = [
                randomCanvas({ startBlockHeight: BigInt(100), endBlockHeight: BigInt(200), state: CanvasState.PENDING }),
                randomCanvas({ startBlockHeight: BigInt(100), endBlockHeight: BigInt(200), state: CanvasState.PENDING }),
                randomCanvas({ startBlockHeight: BigInt(100), endBlockHeight: BigInt(200), state: CanvasState.PENDING }),

                randomCanvas({ startBlockHeight: BigInt(50), endBlockHeight: BigInt(150), state: CanvasState.ACTIVE }),
                randomCanvas({ startBlockHeight: BigInt(50), endBlockHeight: BigInt(150), state: CanvasState.ACTIVE }),
                randomCanvas({ startBlockHeight: BigInt(50), endBlockHeight: BigInt(150), state: CanvasState.ACTIVE }),

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
                block: randomBlock({ height: 99 }),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, "set");

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

        it("uninitialized canvases", async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
            });
            const context = testing.createAfterBlockApplyContext({
                block: randomBlock(),
                stateStore
            });
            const setMock = jest.spyOn(stateStore.chain, "set");

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

        it("should notify draw pixel assets committed", async () => {
            const stateStore = new testing.mocks.StateStoreMock({
                accounts: [account]
            });
            const height = numberBetween(0, 10000);
            const drawPixelAssets = [
                randomDrawPixel(),
                randomDrawPixel(),
            ];
            const payload = [
                randomTransaction(), // Ignored because module and asset IDs don't match
                randomTransaction({ moduleID: CanvasModule.MODULE_ID }), // Ignored because asset ID doesn't match
                randomTransaction({ assetID: DrawPixelAsset.ASSET_ID }), // Ignored because module ID doesn't match
                randomTransaction({
                    moduleID: CanvasModule.MODULE_ID,
                    assetID: DrawPixelAsset.ASSET_ID,
                    asset: codec.encode(drawPixelSchema, drawPixelAssets[0])
                }),
                randomTransaction({
                    moduleID: CanvasModule.MODULE_ID,
                    assetID: DrawPixelAsset.ASSET_ID,
                    asset: codec.encode(drawPixelSchema, drawPixelAssets[1])
                }),
            ];
            const channel: BaseModuleChannel = testing.mocks.channelMock;
            const publishMock = jest.spyOn(channel, "publish");

            testClass.init({
                channel: channel,
                logger: testing.mocks.loggerMock,
                dataAccess: new testing.mocks.DataAccessMock(),
            });

            const context = testing.createAfterBlockApplyContext({
                block: randomBlock({ height }, payload),
                stateStore
            });
            await testClass.afterBlockApply(context);

            expect(publishMock).toHaveBeenCalledWith(
                "canvas:pixelChangeCommitted",
                {
                    address: payload[3].senderAddress.toString("hex"),
                    transactionId: payload[3].id.toString("hex"),
                    blockHeight: height,
                    pixel: drawPixelAssets[0],
                }
            );
            expect(publishMock).toHaveBeenCalledWith(
                "canvas:pixelChangeCommitted",
                {
                    address: payload[4].senderAddress.toString("hex"),
                    transactionId: payload[4].id.toString("hex"),
                    blockHeight: height,
                    pixel: drawPixelAssets[1],
                }
            );
        });
    });

    describe("afterTransactionApply", () => {
        let channel: BaseModuleChannel;

        beforeEach(() => {
            channel = testing.mocks.channelMock;
            testClass.init({
                channel: channel,
                logger: testing.mocks.loggerMock,
                dataAccess: new testing.mocks.DataAccessMock(),
            });
        });

        it("should notify draw pixel assets submitted", async () => {
            const publishMock = jest.spyOn(channel, "publish");
            const drawPixelAsset = randomDrawPixel();
            const transaction = randomTransaction({
                moduleID: CanvasModule.MODULE_ID,
                assetID: DrawPixelAsset.ASSET_ID,
                asset: codec.encode(drawPixelSchema, drawPixelAsset),
            });

            const context = testing.createTransactionApplyContext({ transaction });
            await testClass.afterTransactionApply(context);

            expect(publishMock).toHaveBeenCalledWith(
                "canvas:pixelChangeSubmitted",
                {
                    address: transaction.senderAddress.toString("hex"),
                    transactionId: transaction.id.toString("hex"),
                    pixel: drawPixelAsset,
                }
            );
        });

        it("should ignore transactions with incorrect module id", async () => {
            const publishMock = jest.spyOn(channel, "publish");
            const transaction = randomTransaction({
                moduleID: numberBetween(100000, 1000000),
                assetID: DrawPixelAsset.ASSET_ID,
            });

            const context = testing.createTransactionApplyContext({ transaction });
            await testClass.afterTransactionApply(context);

            expect(publishMock).toHaveBeenCalledTimes(0);
        });

        it("should ignore transactions with incorrect asset id", async () => {
            const publishMock = jest.spyOn(channel, "publish");
            const transaction = randomTransaction({
                moduleID: CanvasModule.MODULE_ID,
                assetID: numberBetween(100000, 1000000),
            });

            const context = testing.createTransactionApplyContext({ transaction });
            await testClass.afterTransactionApply(context);

            expect(publishMock).toHaveBeenCalledTimes(0);
        });
    });
});
