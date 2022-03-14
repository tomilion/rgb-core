import { ApplyAssetContext, BaseAsset, codec, ValidateAssetContext } from "lisk-sdk";
import { serialiseAccountId, serialiseCanvasId, serialisePixelId } from "../utils";
import { AccountPayload, accountSchema, CanvasPayload, canvasSchema, CanvasState, pixelSchema } from "../schemas";

export interface DrawPixelPayload {
    canvasId: number;
    coords: number;
    colour: number;
}

export const drawPixelSchema = {
    $id: "canvas/drawPixel/asset",
    title: "DrawPixelAsset transaction asset for Canvas module",
    type: "object",
    required: ["canvasId", "coords", "colour"],
    properties: {
        canvasId: { fieldNumber: 1, dataType: "uint32" },
        coords: { fieldNumber: 2, dataType: "uint32" },
        colour: { fieldNumber: 3, dataType: "uint32" },
    },
};

export class DrawPixelAsset extends BaseAsset<DrawPixelPayload> {
    public static readonly ASSET_ID = 5;

    public name = "drawPixel";
    public id = DrawPixelAsset.ASSET_ID;
    public schema = drawPixelSchema;

    private readonly wallet: string;

    public constructor(wallet: string) {
        super();
        this.wallet = wallet;
    }

    public validate({ asset }: ValidateAssetContext<DrawPixelPayload>): void {
        // Sanity check that coords are within 10000 x 10000 grid
        if (asset.coords < 0 || asset.coords >= 100000000)
        {
            throw Error("Coords invalid");
        }

        // Only first 3 bytes should contain colour information
        if (asset.colour < 0 || asset.colour > 0x00FFFFFF)
        {
            throw Error("Colour invalid");
        }
    }

    public async apply({ asset, transaction, stateStore, reducerHandler }: ApplyAssetContext<DrawPixelPayload>): Promise<void> {
        const canvasId = serialiseCanvasId(asset.canvasId);
        const canvasBuffer = await stateStore.chain.get(canvasId);

        if (canvasBuffer === undefined)
        {
            throw Error("Canvas does not exist");
        }

        const canvas = codec.decode<CanvasPayload>(canvasSchema, canvasBuffer);

        if (canvas.state !== CanvasState.ACTIVE)
        {
            throw Error("Canvas not active");
        }

        // Coords encoded as numbered position in canvas eg. (1, 1) in a 1000 x 1000 canvas would be encoded as (1001)
        // as 0 -> 999 is y = 0 and 1000 -> 1999 is y = 1
        if (asset.coords >= (canvas.width * canvas.height))
        {
            throw Error("Coords invalid");
        }

        // Check user has waited for draw timeout before drawing again
        const accountId = serialiseAccountId(asset.canvasId, transaction.senderAddress.toString("hex"));
        const accountBuffer = await stateStore.chain.get(accountId);
        const account = (accountBuffer !== undefined) ? codec.decode<AccountPayload>(accountSchema, accountBuffer) : { lastBlockHeight: 0 };
        const lastBlockHeight = await reducerHandler.invoke<number>("canvas:getLastBlockHeight");
        const currentBlockHeight = lastBlockHeight + 1;

        // TODO: get block time from config
        if ((account.lastBlockHeight + (canvas.timeBetweenDraws / 10)) > currentBlockHeight)
        {
            throw Error("Too many draws");
        }

        await reducerHandler.invoke("token:debit", {
            address: transaction.senderAddress,
            amount: canvas.costPerPixel,
        });

        await reducerHandler.invoke("token:credit", {
            address: Buffer.from(this.wallet, "hex"),
            amount: canvas.costPerPixel,
        });

        const xCoord = asset.coords % canvas.width;
        const yCoord = Math.floor(asset.coords / canvas.height);
        const pixelId = serialisePixelId(asset.canvasId, xCoord, yCoord);

        // Update colour and current owner of pixel
        await stateStore.chain.set(pixelId, codec.encode(pixelSchema, { ownerId: transaction.senderAddress, colour: asset.colour }));

        // Set last draw time
        await stateStore.chain.set(accountId, codec.encode(accountSchema, { lastBlockHeight: currentBlockHeight }));
    }
}
