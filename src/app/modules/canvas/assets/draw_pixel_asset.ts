import { ApplyAssetContext, BaseAsset, codec, ValidateAssetContext } from "lisk-sdk";
import { serialiseAccountId, serialiseCanvasId } from "../utils";
import { AccountPayload, accountSchema, CanvasPayload, canvasSchema, CanvasState, DrawPixelPayload, drawPixelSchema } from "../schemas";

export class DrawPixelAsset extends BaseAsset<DrawPixelPayload> {
    public static readonly ASSET_ID = 5;

    public name = "drawPixel";
    public id = DrawPixelAsset.ASSET_ID;
    public schema = drawPixelSchema;

    public validate(context: ValidateAssetContext<DrawPixelPayload>): void {
        const { asset } = context;

        if (asset.colours.length < 1)
        {
            throw new Error("Requires at least 1 colour");
        }

        // 24 bit coordinates (supports max canvas size of approx 4k * 4k)
        if ((asset.coords.length % 3) > 0)
        {
            throw new Error("Coords invalid");
        }

        if (Math.ceil(asset.coords.length / 3 / 2) !== asset.colours.length)
        {
            throw new Error("Number of coords does not match number of colours");
        }
    }

    public async apply(context: ApplyAssetContext<DrawPixelPayload>): Promise<void> {
        const { asset, transaction, stateStore, reducerHandler } = context;
        const canvasId = serialiseCanvasId(asset.canvasId);
        const canvasBuffer = await stateStore.chain.get(canvasId);

        if (canvasBuffer === undefined)
        {
            throw new Error("Canvas does not exist");
        }

        const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);

        if (canvas.state !== CanvasState.ACTIVE)
        {
            throw new Error("Canvas not active");
        }

        if ((asset.coords.length / 3) > canvas.maxPixelsPerTransaction)
        {
            throw new Error("Too many pixels");
        }

        for (let i = 0; i < asset.coords.length; i += 3)
        {
            // 24 bit coordinate packed with little endianness
            const coord = asset.coords[i] | (asset.coords[i + 1] << 8) | (asset.coords[i + 2] << 16);

            // Coords encoded as numbered position in canvas eg. (1, 1) in a 1000 x 1000 canvas would be encoded as (1001)
            // where 0 -> 999 is y = 0 and 1000 -> 1999 is y = 1 (both cases x = {0 -> 999})
            if (coord >= (canvas.width * canvas.height))
            {
                throw new Error("Coords invalid");
            }
        }

        // Check user has waited for draw timeout before drawing again
        const accountId = serialiseAccountId(asset.canvasId, transaction.senderAddress.toString("hex"));
        const accountBuffer = await stateStore.chain.get(accountId);
        const account = (accountBuffer !== undefined) ? codec.decode<AccountPayload>(accountSchema, accountBuffer) : { lastBlockHeight: 0 };
        const lastBlock = stateStore.chain.lastBlockHeaders[stateStore.chain.lastBlockHeaders.length - 1];

        if ((account.lastBlockHeight + canvas.timeBetweenDraws) > (lastBlock.height + 1))
        {
            throw new Error("Too many draws");
        }

        const walletAddress = await reducerHandler.invoke<Buffer>("canvas:getWalletAddress");

        await reducerHandler.invoke("token:debit", {
            address: transaction.senderAddress,
            amount: canvas.costPerPixel,
        });

        await reducerHandler.invoke("token:credit", {
            address: walletAddress,
            amount: canvas.costPerPixel,
        });

        // Set last draw time
        await stateStore.chain.set(accountId, codec.encode(accountSchema, { lastBlockHeight: lastBlock.height + 1 }));
    }
}
