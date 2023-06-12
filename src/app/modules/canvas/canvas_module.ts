import { AfterBlockApplyContext, AfterGenesisBlockApplyContext, BaseModule, BeforeBlockApplyContext, codec, TransactionApplyContext } from "lisk-sdk";
import { strict as assert } from "assert";
import { ChangeCanvasAsset } from "./assets/change_canvas_asset";
import { CreateCanvasAsset } from "./assets/create_canvas_asset";
import { DrawPixelAsset, DrawPixelPayload, drawPixelSchema } from "./assets/draw_pixel_asset";
import { serialiseCanvasId } from "./utils";
import { AccountType, ActivePayload, activeSchema, AddressPayload, addressSchema, CanvasAccount, CanvasPayload, CanvasResponse, canvasSchema, CanvasState, CompletePayload, completeSchema, PendingPayload, pendingSchema } from "./schemas";

export class CanvasModule extends BaseModule {
    public static readonly MODULE_ID = 1000;

    public name = "canvas";
    public id = CanvasModule.MODULE_ID;
    public accountSchema = {
        type: "object",
        properties: {
            accountType: {
                fieldNumber: 1,
                dataType: "string",
                maxLength: 64,
            },
        },
        default: {
            accountType: AccountType.Default.toString(),
        },
    };
    public actions = {
        getCanvas: async (params) => this.getCanvas(params),
        getPendingCanvases: async () => this.getPendingCanvases(),
        getActiveCanvases: async () => this.getActiveCanvases(),
        getCompleteCanvases: async () => this.getCompleteCanvases(),
    };
    public reducers = {
        getWalletAddress: async () => this.getWalletAddress(),
        getAdminAddress: async () => this.getAdminAddress(),
    };
    public transactionAssets = [
        new CreateCanvasAsset(),
        new ChangeCanvasAsset(),
        new DrawPixelAsset(),
    ];
    public events = ["started", "completed", "pixelChangeSubmitted", "pixelChangeCommitted"];

    // Lifecycle hooks
    public async beforeBlockApply(_input: BeforeBlockApplyContext): Promise<void> {
        // Get any data from stateStore using block info, below is an example getting a generator
        // const generatorAddress = getAddressFromPublicKey(_input.block.header.generatorPublicKey);
        // const generator = await _input.stateStore.account.get<TokenAccount>(generatorAddress);
    }

    public async afterBlockApply(context: AfterBlockApplyContext): Promise<void> {
        const { block, stateStore } = context;
        const pendingToCommit: number[] = [];
        const activeToCommit: number[] = [];

        const pendingBuffer = await stateStore.chain.get("canvas:pending");
        const pending = (pendingBuffer !== undefined) ? codec.decode<PendingPayload>(pendingSchema, pendingBuffer) : { canvasIds: [] };

        const activeBuffer = await stateStore.chain.get("canvas:active");
        const active = (activeBuffer !== undefined) ? codec.decode<ActivePayload>(activeSchema, activeBuffer) : { canvasIds: [] };

        const completeBuffer = await stateStore.chain.get("canvas:complete");
        const complete = (completeBuffer !== undefined) ? codec.decode<CompletePayload>(completeSchema, completeBuffer) : { canvasIds: [] };

        for (const canvasId of pending.canvasIds)
        {
            const canvasBuffer = await stateStore.chain.get(serialiseCanvasId(canvasId));
            assert(canvasBuffer !== undefined);
            const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);
            assert(canvas.state === CanvasState.PENDING);

            // Automatically starting canvas after passing start time
            if (canvas.startBlockHeight <= block.header.height)
            {
                canvas.state = CanvasState.ACTIVE;
                await stateStore.chain.set(serialiseCanvasId(canvasId), codec.encode(canvasSchema, canvas));
                activeToCommit.push(canvasId);
                this._channel.publish("canvas:started", { canvasId });
                continue;
            }

            pendingToCommit.push(canvasId);
        }

        for (const transaction of block.payload)
        {
            if (transaction.moduleID === CanvasModule.MODULE_ID &&
                transaction.assetID === DrawPixelAsset.ASSET_ID)
            {
                const pixel = codec.decode<DrawPixelPayload>(drawPixelSchema, transaction.asset);
                this._channel.publish("canvas:pixelChangeCommitted", {
                    address: transaction.senderAddress.toString("hex"),
                    transactionId: transaction.id.toString("hex"),
                    blockHeight: block.header.height,
                    pixel: pixel,
                });
            }
        }

        for (const canvasId of active.canvasIds)
        {
            const canvasBuffer = await stateStore.chain.get(serialiseCanvasId(canvasId));
            assert(canvasBuffer !== undefined);
            const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);
            assert(canvas.state === CanvasState.ACTIVE);

            // Automatically ending canvas after passing end time
            if (canvas.endBlockHeight <= block.header.height)
            {
                canvas.state = CanvasState.COMPLETE;
                await stateStore.chain.set(serialiseCanvasId(canvasId), codec.encode(canvasSchema, canvas));
                complete.canvasIds.push(canvasId);
                this._channel.publish("canvas:completed", { canvasId });
                continue;
            }

            activeToCommit.push(canvasId);
        }

        await stateStore.chain.set("canvas:pending", codec.encode(pendingSchema, { canvasIds: pendingToCommit }));
        await stateStore.chain.set("canvas:active", codec.encode(activeSchema, { canvasIds: activeToCommit }));
        await stateStore.chain.set("canvas:complete", codec.encode(completeSchema, complete));
    }

    public async beforeTransactionApply(_input: TransactionApplyContext): Promise<void> {
        // Get any data from stateStore using transaction info, below is an example
        // const sender = await _input.stateStore.account.getOrDefault<TokenAccount>(_input.transaction.senderAddress);
    }

    public async afterTransactionApply(_input: TransactionApplyContext): Promise<void> {
        if (_input.transaction.moduleID === CanvasModule.MODULE_ID &&
            _input.transaction.assetID === DrawPixelAsset.ASSET_ID)
        {
            const pixel = codec.decode<DrawPixelPayload>(drawPixelSchema, _input.transaction.asset);
            this._channel.publish("canvas:pixelChangeSubmitted", {
                address: _input.transaction.senderAddress.toString("hex"),
                transactionId: _input.transaction.id.toString("hex"),
                pixel: pixel,
            });
        }
    }

    public async afterGenesisBlockApply(_input: AfterGenesisBlockApplyContext<CanvasAccount>): Promise<void> {
        const accounts = _input.genesisBlock.header.asset.accounts;
        assert(accounts.length > 0);

        for (const account of accounts)
        {
            if (account.canvas.accountType == AccountType.Admin.toString())
            {
                await _input.stateStore.chain.set("canvas:adminAddress", codec.encode(addressSchema, { address: account.address }));
            }

            if (account.canvas.accountType == AccountType.Wallet.toString())
            {
                await _input.stateStore.chain.set("canvas:walletAddress", codec.encode(addressSchema, { address: account.address }));
            }
        }
    }

    private async getCanvas(params: { canvasId: string }): Promise<CanvasResponse|null> {
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
            startBlockHeight: Number(canvas.startBlockHeight),
            endBlockHeight: Number(canvas.endBlockHeight),
        };
    }

    private async getPendingCanvases(): Promise<PendingPayload> {
        const pendingBuffer = await this._dataAccess.getChainState("canvas:pending");

        if (pendingBuffer === undefined)
        {
            return { canvasIds: [] };
        }

        return codec.decode<PendingPayload>(pendingSchema, pendingBuffer);
    }

    private async getActiveCanvases(): Promise<ActivePayload> {
        const activeBuffer = await this._dataAccess.getChainState("canvas:active");

        if (activeBuffer === undefined)
        {
            return { canvasIds: [] };
        }

        return codec.decode<ActivePayload>(activeSchema, activeBuffer);
    }

    private async getCompleteCanvases(): Promise<CompletePayload> {
        const completeBuffer = await this._dataAccess.getChainState("canvas:complete");

        if (completeBuffer === undefined)
        {
            return { canvasIds: [] };
        }

        return codec.decode<CompletePayload>(completeSchema, completeBuffer);
    }

    private async getWalletAddress(): Promise<Buffer|null> {
        const walletBuffer: Buffer|undefined = await this._dataAccess.getChainState("canvas:walletAddress");

        if (walletBuffer === undefined)
        {
            return null;
        }

        const wallet = codec.decode<AddressPayload>(addressSchema, walletBuffer);
        return wallet.address;
    }

    private async getAdminAddress(): Promise<Buffer|null> {
        const adminBuffer: Buffer|undefined = await this._dataAccess.getChainState("canvas:adminAddress");

        if (adminBuffer === undefined)
        {
            return null;
        }

        const admin = codec.decode<AddressPayload>(addressSchema, adminBuffer);
        return admin.address;
    }
}
