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

        // Sanity check that coords are within 10000 x 10000 grid
        if (asset.coords < 0 || asset.coords >= 100000000)
        {
            throw new Error("Coords invalid");
        }

        // Only first 3 bytes should contain colour information
        if (asset.colour < 0 || asset.colour > 0x00FFFFFF)
        {
            throw new Error("Colour invalid");
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

        // Coords encoded as numbered position in canvas eg. (1, 1) in a 1000 x 1000 canvas would be encoded as (1001)
        // as 0 -> 999 is y = 0 and 1000 -> 1999 is y = 1
        if (asset.coords >= (canvas.width * canvas.height))
        {
            throw new Error("Coords invalid");
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
