import { AfterBlockApplyContext, AfterGenesisBlockApplyContext, BaseModule, BeforeBlockApplyContext, codec, TransactionApplyContext } from "lisk-sdk";
import { strict as assert } from "assert";
import { ChangeCanvasAsset } from "./assets/change_canvas_asset";
import { CreateCanvasAsset } from "./assets/create_canvas_asset";
import { DrawPixelAsset, DrawPixelPayload, drawPixelSchema } from "./assets/draw_pixel_asset";
import { serialiseCanvasId, serialisePixelId } from "./utils";
import { ActivePayload, activeSchema, CanvasPayload, canvasSchema, CanvasState, CompletePayload, completeSchema, PendingPayload, pendingSchema, PixelPayload, pixelSchema } from "./schemas";

export class CanvasModule extends BaseModule {
    public static readonly MODULE_ID = 1000;

    public name = "canvas";
    public id = CanvasModule.MODULE_ID;
    public actions = {
        getCanvas: async (params: Record<string, unknown>) => this.getCanvas(params),
        getPendingCanvases: async () => this.getPendingCanvases(),
        getActiveCanvases: async () => this.getActiveCanvases(),
        getCompleteCanvases: async () => this.getCompleteCanvases(),
        getPixels: async (params: Record<string, unknown>) => this.getPixels(params),
    };
    public reducers = {
        getLastBlockHeight: async () => this.getLastBlockHeight(),
    };
    public transactionAssets = [
        new CreateCanvasAsset(process.env.CANVAS_ADMIN_ADDRESS ?? ''),
        new ChangeCanvasAsset(process.env.CANVAS_ADMIN_ADDRESS ?? ''),
        new DrawPixelAsset(process.env.CANVAS_WALLET_ADDRESS ?? ''),
    ];
    public events = ["started", "completed", "pixelChanged"];

    // Lifecycle hooks
    public async beforeBlockApply(_input: BeforeBlockApplyContext) {
        // Get any data from stateStore using block info, below is an example getting a generator
        // const generatorAddress = getAddressFromPublicKey(_input.block.header.generatorPublicKey);
        // const generator = await _input.stateStore.account.get<TokenAccount>(generatorAddress);
    }

    public async afterBlockApply(context: AfterBlockApplyContext) {
        const now = BigInt(Math.floor(Date.now() / 1000));

        const pendingToCommit: number[] = [];
        const activeToCommit: number[] = [];

        const pendingBuffer = await context.stateStore.chain.get("canvas:pending");
        const pending = (pendingBuffer !== undefined) ? codec.decode<PendingPayload>(pendingSchema, pendingBuffer) : { canvasIds: [] };

        const activeBuffer = await context.stateStore.chain.get("canvas:active");
        const active = (activeBuffer !== undefined) ? codec.decode<ActivePayload>(activeSchema, activeBuffer) : { canvasIds: [] };

        const completeBuffer = await context.stateStore.chain.get("canvas:complete");
        const complete = (completeBuffer !== undefined) ? codec.decode<CompletePayload>(completeSchema, completeBuffer) : { canvasIds: [] };

        for (const canvasId of pending.canvasIds)
        {
            const canvasBuffer = await context.stateStore.chain.get(serialiseCanvasId(canvasId));
            assert(canvasBuffer !== undefined);
            const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);
            assert(canvas.state === CanvasState.PENDING);

            // Automatically starting canvas after passing start time
            if (canvas.startTime <= now)
            {
                canvas.state = CanvasState.ACTIVE;
                await context.stateStore.chain.set(serialiseCanvasId(canvasId), codec.encode(canvasSchema, canvas));
                activeToCommit.push(canvasId);
                this._channel.publish("canvas:started", { canvasId });
                continue;
            }

            pendingToCommit.push(canvasId);
        }

        for (const canvasId of active.canvasIds)
        {
            const canvasBuffer = await context.stateStore.chain.get(serialiseCanvasId(canvasId));
            assert(canvasBuffer !== undefined);
            const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);
            assert(canvas.state === CanvasState.ACTIVE);

            // Automatically ending canvas after passing end time
            if (canvas.endTime <= now)
            {
                canvas.state = CanvasState.COMPLETE;
                await context.stateStore.chain.set(serialiseCanvasId(canvasId), codec.encode(canvasSchema, canvas));
                complete.canvasIds.push(canvasId);
                this._channel.publish("canvas:completed", { canvasId });
                continue;
            }

            activeToCommit.push(canvasId);
        }

        await context.stateStore.chain.set("canvas:pending", codec.encode(pendingSchema, { canvasIds: pendingToCommit }));
        await context.stateStore.chain.set("canvas:active", codec.encode(activeSchema, { canvasIds: activeToCommit }));
        await context.stateStore.chain.set("canvas:complete", codec.encode(completeSchema, complete));
    }

    public async beforeTransactionApply(_input: TransactionApplyContext) {
        // Get any data from stateStore using transaction info, below is an example
        // const sender = await _input.stateStore.account.getOrDefault<TokenAccount>(_input.transaction.senderAddress);
    }

    public async afterTransactionApply(_input: TransactionApplyContext) {
        if (_input.transaction.moduleID === CanvasModule.MODULE_ID &&
            _input.transaction.assetID === DrawPixelAsset.ASSET_ID)
        {
            const pixel = codec.decode<DrawPixelPayload>(drawPixelSchema, _input.transaction.asset);
            this._channel.publish("canvas:pixelChanged", {
                ownerId: _input.transaction.senderAddress.toString("hex"),
                ...pixel,
            });
        }
    }

    public async afterGenesisBlockApply(_input: AfterGenesisBlockApplyContext) {
        // Get any data from genesis block, for example get all genesis accounts
        // const genesisAccounts = genesisBlock.header.asset.accounts;
    }

    private async getCanvas(params: Record<string, unknown>) {
        const canvasId = serialiseCanvasId(Number(params.canvasId));
        const canvasBuffer = await this._dataAccess.getChainState(canvasId);

        if (canvasBuffer === undefined)
        {
            return null;
        }

        const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);
        return {
            ...canvas,
            ownerId: canvas.ownerId.toString("hex"),
            costPerPixel: Number(canvas.costPerPixel),
            startTime: Number(canvas.startTime),
            endTime: Number(canvas.endTime),
            seed: Number(canvas.seed),
        };
    }

    private async getPendingCanvases() {
        const pendingBuffer = await this._dataAccess.getChainState("canvas:pending");

        if (pendingBuffer === undefined)
        {
            return [];
        }

        return codec.decode<PendingPayload>(pendingSchema, pendingBuffer);
    }

    private async getActiveCanvases() {
        const activeBuffer = await this._dataAccess.getChainState("canvas:active");

        if (activeBuffer === undefined)
        {
            return [];
        }

        return codec.decode<ActivePayload>(activeSchema, activeBuffer);
    }

    private async getCompleteCanvases() {
        const completeBuffer = await this._dataAccess.getChainState("canvas:complete");

        if (completeBuffer === undefined)
        {
            return [];
        }

        return codec.decode<CompletePayload>(completeSchema, completeBuffer);
    }

    private async getPixels(params: Record<string, unknown>) {
        const canvasId = serialiseCanvasId(Number(params.canvasId));
        const canvasBuffer = await this._dataAccess.getChainState(canvasId);

        if (canvasBuffer === undefined)
        {
            return null;
        }

        const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);
        const pixels: number[][] = [];

        for (let y = 0; y < canvas.height; y += 1)
        {
            if (pixels[y] === undefined)
            {
                pixels[y] = [];
            }

            for (let x = 0; x < canvas.width; x += 1)
            {
                const pixelId = serialisePixelId(Number(params.canvasId), x, y);
                const pixelBuffer = await this._dataAccess.getChainState(pixelId);

                if (pixelBuffer === undefined)
                {
                    pixels[y][x] = 0xFFFFFF;
                    continue;
                }

                const pixel = codec.decode<PixelPayload>(pixelSchema, pixelBuffer);
                pixels[y][x] = pixel.colour;
            }
        }

        return pixels;
    };

    private async getLastBlockHeight() {
        const header = await this._dataAccess.getLastBlockHeader();
        return header.height;
    }
}
