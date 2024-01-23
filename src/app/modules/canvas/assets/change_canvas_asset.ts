import { ApplyAssetContext, BaseAsset, codec, ValidateAssetContext } from "lisk-sdk";
import { serialiseCanvasId } from "../utils";
import { CanvasPayload, canvasSchema, CanvasState, ChangeCanvasPayload } from "../schemas";

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
            startBlockHeight: { fieldNumber: 3, dataType: "uint64" },
            endBlockHeight: { fieldNumber: 4, dataType: "uint64" },
            width: { fieldNumber: 5, dataType: "uint32" },
            height: { fieldNumber: 6, dataType: "uint32" },
            timeBetweenDraws: { fieldNumber: 7, dataType: "uint32" },
            colourPalette: { fieldNumber: 8, dataType: "bytes", minLength: 48, maxLength: 48 },
            maxPixelsPerTransaction: { fieldNumber: 9, dataType: "uint32" },
            label: { fieldNumber: 10, dataType: "string", minLength: 0, maxLength: 64 },
        },
    };

    public validate(context: ValidateAssetContext<ChangeCanvasPayload>): void {
        const { asset, header } = context;

        if (asset.width !== undefined && asset.width !== null && (asset.width < 1 || asset.width > 10000))
        {
            throw new Error("Width invalid");
        }

        if (asset.height !== undefined && asset.height !== null && (asset.height < 1 || asset.height > 10000))
        {
            throw new Error("Height invalid");
        }

        if (asset.costPerPixel !== undefined && asset.costPerPixel !== null && asset.costPerPixel < 0)
        {
            throw new Error("Cost per pixel invalid");
        }

        // Checking undefined/null inline because storing condition in variable is too complex for linter ...
        if (asset.startBlockHeight !== undefined && asset.startBlockHeight !== null && asset.startBlockHeight < header.height)
        {
            throw new Error("Start block height cannot be in the past");
        }

        // Checking undefined/null inline because storing condition in variable is too complex for linter ...
        if (asset.endBlockHeight !== undefined && asset.endBlockHeight !== null && asset.endBlockHeight < header.height)
        {
            throw new Error("End block height cannot be in the past");
        }

        // Checking undefined/null inline because storing condition in variable is too complex for linter ...
        if (asset.startBlockHeight !== undefined &&
            asset.startBlockHeight !== null &&
            asset.endBlockHeight !== undefined &&
            asset.endBlockHeight !== null &&
            asset.endBlockHeight < asset.startBlockHeight)
        {
            throw new Error("End block height must be greater than start block height");
        }

        if (asset.maxPixelsPerTransaction !== undefined && asset.maxPixelsPerTransaction !== null && (asset.maxPixelsPerTransaction < 1 || asset.maxPixelsPerTransaction > 10000))
        {
            throw new Error("Max pixels per transaction invalid");
        }

        if (asset.colourPalette !== undefined && asset.colourPalette !== null && asset.colourPalette.length !== 48)
        {
            throw new Error("Colour palette invalid");
        }
    }

    public async apply(context: ApplyAssetContext<ChangeCanvasPayload>): Promise<void> {
        const { asset, stateStore, transaction } = context;
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

        if (canvas.state === CanvasState.COMPLETE)
        {
            throw new Error("Canvas already completed");
        }

        if (canvas.state === CanvasState.ACTIVE)
        {
            if (asset.startBlockHeight !== null && asset.startBlockHeight !== undefined)
            {
                throw new Error("Cannot modify start block height on active canvas");
            }

            if (asset.endBlockHeight !== null && asset.endBlockHeight !== undefined)
            {
                throw new Error("Cannot modify end block height on active canvas");
            }
        }

        canvas.width = asset.width ?? canvas.width;
        canvas.height = asset.height ?? canvas.height;
        canvas.costPerPixel = asset.costPerPixel ?? canvas.costPerPixel;
        canvas.startBlockHeight = asset.startBlockHeight ?? canvas.startBlockHeight;
        canvas.endBlockHeight = asset.endBlockHeight ?? canvas.endBlockHeight;
        canvas.timeBetweenDraws = asset.timeBetweenDraws ?? canvas.timeBetweenDraws;
        canvas.colourPalette = asset.colourPalette ?? canvas.colourPalette;
        canvas.maxPixelsPerTransaction = asset.maxPixelsPerTransaction ?? canvas.maxPixelsPerTransaction;
        canvas.label = asset.label ?? canvas.label;

        if (canvas.startBlockHeight > canvas.endBlockHeight)
        {
            throw new Error("End block height must be greater than start block height");
        }

        await stateStore.chain.set(canvasId, codec.encode(canvasSchema, canvas));
    }
}
