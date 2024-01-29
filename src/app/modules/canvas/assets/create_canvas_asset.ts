import { ApplyAssetContext, BaseAsset, codec, ValidateAssetContext } from "lisk-sdk";
import { serialiseCanvasId } from "../utils";
import { canvasSchema, CreateCanvasPayload, createCanvasSchema, PendingPayload, pendingSchema } from "../schemas";

export class CreateCanvasAsset extends BaseAsset<CreateCanvasPayload> {
    public static readonly ASSET_ID = 0;

    public name = "createCanvas";
    public id = CreateCanvasAsset.ASSET_ID;
    public schema = createCanvasSchema;

    public validate(context: ValidateAssetContext<CreateCanvasPayload>): void {
        const { asset, header } = context;

        if (asset.width < 1 || asset.width > 10000)
        {
            throw new Error("Width invalid");
        }

        if (asset.height < 1 || asset.height > 10000)
        {
            throw new Error("Height invalid");
        }

        if (asset.costPerPixel < 0)
        {
            throw new Error("Cost per pixel invalid");
        }

        if (asset.startBlockHeight < header.height)
        {
            throw new Error("Start block height cannot be in the past");
        }

        if (asset.endBlockHeight < header.height)
        {
            throw new Error("End block height cannot be in the past");
        }

        if (asset.startBlockHeight > asset.endBlockHeight)
        {
            throw new Error("End block height must be greater than start block height");
        }

        if (asset.maxPixelsPerTransaction < 1 || asset.maxPixelsPerTransaction > 10000)
        {
            throw new Error("Max pixels per transaction invalid");
        }

        if (asset.colourPalette.length !== 48)
        {
            throw new Error("Colour palette invalid");
        }
    }

    public async apply(context: ApplyAssetContext<CreateCanvasPayload>): Promise<void> {
        const { asset, stateStore, reducerHandler, transaction } = context;
        const adminAddress = await reducerHandler.invoke<Buffer>("canvas:getAdminAddress");

        if (transaction.senderAddress.compare(adminAddress) !== 0)
        {
            throw new Error("User invalid");
        }

        const canvasId = serialiseCanvasId(asset.canvasId);
        const currentCanvas = await stateStore.chain.get(canvasId);

        if (currentCanvas !== undefined)
        {
            throw new Error("Canvas already exists");
        }

        // Add canvas to state store
        const canvas = {
            ownerId: transaction.senderAddress,
            costPerPixel: asset.costPerPixel,
            startBlockHeight: asset.startBlockHeight,
            endBlockHeight: asset.endBlockHeight,
            width: asset.width,
            height: asset.height,
            timeBetweenDraws: asset.timeBetweenDraws,
            colourPalette: asset.colourPalette,
            maxPixelsPerTransaction: asset.maxPixelsPerTransaction,
            label: asset.label ?? "",
        };
        await stateStore.chain.set(canvasId, codec.encode(canvasSchema, canvas));

        // Add canvas to pending for post block event to determine when to start
        const pendingBuffer = await stateStore.chain.get("canvas:pending");
        const pending = (pendingBuffer !== undefined) ? codec.decode<PendingPayload>(pendingSchema, pendingBuffer) : { canvasIds: [] };
        pending.canvasIds.push(asset.canvasId);
        await stateStore.chain.set("canvas:pending", codec.encode(pendingSchema, pending));
    }
}
