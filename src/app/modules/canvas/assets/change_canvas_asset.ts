import { ApplyAssetContext, BaseAsset, codec, ValidateAssetContext } from "lisk-sdk";
import { serialiseCanvasId } from "../utils";
import { CanvasPayload, canvasSchema, CanvasState } from "../schemas";

export interface ChangeCanvasPayload {
    canvasId: number;
    costPerPixel?: bigint | null;
    startTime?: bigint | null;
    endTime?: bigint | null;
    width?: number | null;
    height?: number | null;
    timeBetweenDraws?: number | null;
    seed?: bigint | null;
}

export class ChangeCanvasAsset extends BaseAsset<ChangeCanvasPayload> {
    public static readonly ASSET_ID = 1;

    public name = "changeCanvas";
    public id = ChangeCanvasAsset.ASSET_ID;
    public schema = {
        $id: "canvas/changeCanvas-asset",
        title: "ChangeCanvasAsset transaction asset for canvas module",
        type: "object",
        required: ["canvasId"],
        properties: {
            canvasId: { fieldNumber: 1, dataType: "uint32" },
            costPerPixel: { fieldNumber: 2, dataType: "uint64" },
            startTime: { fieldNumber: 3, dataType: "uint64" },
            endTime: { fieldNumber: 4, dataType: "uint64" },
            width: { fieldNumber: 5, dataType: "uint32" },
            height: { fieldNumber: 6, dataType: "uint32" },
            timeBetweenDraws: { fieldNumber: 7, dataType: "uint32" },
            seed: { fieldNumber: 8, dataType: "uint64" },
        },
    };

    private readonly admin: string;

    public constructor(admin: string) {
        super();
        this.admin = admin;
    }

    public validate({ asset, transaction }: ValidateAssetContext<ChangeCanvasPayload>): void {
        if (transaction.senderAddress.toString("hex") !== this.admin)
        {
            throw new Error("User invalid");
        }

        if ((asset.width !== undefined && asset.width !== null) && (asset.width < 0 || asset.width > 10000))
        {
            throw new Error("Width invalid");
        }

        if ((asset.height !== undefined && asset.height !== null) && (asset.height < 0 || asset.height > 10000))
        {
            throw new Error("Height invalid");
        }

        if ((asset.costPerPixel !== undefined && asset.costPerPixel !== null) && (asset.costPerPixel < 0))
        {
            throw new Error("Cost per pixel invalid");
        }

        if ((asset.seed !== undefined && asset.seed !== null) && (asset.seed < 0))
        {
            throw new Error("Seed invalid");
        }

        const now = BigInt(Math.floor(Date.now() / 1000));

        if ((asset.startTime !== undefined && asset.startTime !== null) && (asset.startTime < now))
        {
            throw new Error("Start time cannot be in the past");
        }

        if ((asset.endTime !== undefined && asset.endTime !== null) && (asset.endTime < now))
        {
            throw new Error("End time cannot be in the past");
        }
    }

    public async apply({ asset, transaction, stateStore }: ApplyAssetContext<ChangeCanvasPayload>): Promise<void> {
        const canvasId = serialiseCanvasId(asset.canvasId);
        const currentCanvas = await stateStore.chain.get(canvasId);

        if (currentCanvas === undefined)
        {
            throw new Error("Canvas does not exist");
        }

        const canvas = codec.decode<CanvasPayload>(canvasSchema, currentCanvas);

        if (canvas.ownerId.toString("hex") !== transaction.senderAddress.toString("hex"))
        {
            throw new Error("User invalid");
        }

        const now = BigInt(Math.floor(Date.now() / 1000));

        if (canvas.endTime < now || canvas.state === CanvasState.COMPLETE)
        {
            throw new Error("Canvas already ended");
        }

        if (canvas.startTime < now || canvas.state === CanvasState.ACTIVE)
        {
            throw new Error("Canvas already started");
        }

        canvas.width = asset.width ?? canvas.width;
        canvas.height = asset.height ?? canvas.height;
        canvas.costPerPixel = asset.costPerPixel ?? canvas.costPerPixel;
        canvas.startTime = asset.startTime ?? canvas.startTime;
        canvas.endTime = asset.endTime ?? canvas.endTime;
        canvas.timeBetweenDraws = asset.timeBetweenDraws ?? canvas.timeBetweenDraws;
        canvas.seed = asset.seed ?? canvas.seed;

        if (canvas.startTime > canvas.endTime)
        {
            throw new Error("End time must be greater than start time");
        }

        await stateStore.chain.set(canvasId, codec.encode(canvasSchema, canvas));
    }
}
