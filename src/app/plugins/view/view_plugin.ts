import { BaseChannel, EventsDefinition, ActionsDefinition, SchemaWithDefault, BasePlugin, PluginInfo } from "lisk-sdk";
import { ActivePayload, CanvasId, CanvasResponse, DrawPixelPayload, DrawPixelPayloadJSON, PixelChangeCommitted, PixelChangeSubmitted } from "../../modules/canvas/schemas";
import { DrawPixelAsset } from "../../modules/canvas/assets/draw_pixel_asset";
import { CanvasModule } from "../../modules/canvas/canvas_module";

interface ViewCache {
    [key: number]: {
        buffer: Buffer;
        width: number;
        height: number;
        view: string|null;
    }
}

interface ViewChanged {
    canvasId: number;
    coords: Uint8Array;
    colours: Uint8Array;
}

interface Submitted {
    [key: number]: {
        [key: string]: PixelChangeSubmitted
    }
}

interface Committed {
    [key: number]: PixelChangeCommitted[]
}

export class ViewPlugin extends BasePlugin {
    private views: ViewCache = {};
    private submitted: Submitted = {};
    private committed: Committed = {};

    public static get alias(): string {
        return "view";
    }

    public static get info(): PluginInfo {
        return {
            author: "tomillion",
            version: "0.1.0",
            name: ViewPlugin.alias,
        };
    }

    public get defaults(): SchemaWithDefault {
        return {
            $id: "#/plugins/view/config",
            type: "object",
            properties: {},
            required: [],
            default: {},
        };
    }

    public get events(): EventsDefinition {
        return ["viewChanged"];
    }

    public get actions(): ActionsDefinition {
        return {
            getView: async (params?: Record<string, unknown>) => this.getView(params),
        };
    }

    public async load(channel: BaseChannel): Promise<void> {
        this.subscribeAppReady(channel);
        this.subscribeCanvasStarted(channel);
        this.subscribeCanvasCompleted(channel);
        this.subscribePixelChangeSubmitted(channel);
        this.subscribePixelChangeCommitted(channel);
    }

    public async unload(): Promise<void> {

    }

    private async getView(params?: Record<string, unknown>): Promise<string|null> {
        const canvasId = params as CanvasId;

        if (!(canvasId.canvasId in this.views))
        {
            return null;
        }

        if (this.views[canvasId.canvasId].view === null)
        {
            this.views[canvasId.canvasId].view = this.views[canvasId.canvasId].buffer.toString("base64");
        }

        return this.views[canvasId.canvasId].view;
    }

    private subscribeAppReady(channel: BaseChannel): void {
        channel.subscribe("app:ready", async () => {
            this._logger.info(null, "Initialising canvas cache");

            const active = await channel.invoke<ActivePayload>("canvas:getActiveCanvases");

            for (const canvasId of active.canvasIds)
            {
                await this.initialiseView(canvasId, channel);
            }

            this._logger.info(null, "Canvas cache initialised");
        });
    }

    private subscribeCanvasStarted(channel: BaseChannel): void {
        channel.subscribe("canvas:started", async (data?: Record<string, unknown>) => {
            const canvasId = data as CanvasId;
            await this.initialiseView(canvasId.canvasId, channel);
        });
    }

    private subscribeCanvasCompleted(channel: BaseChannel): void {
        channel.subscribe("canvas:completed", async (data?: Record<string, unknown>) => {
            const canvasId = data as CanvasId;
            delete this.views[canvasId.canvasId];
            delete this.submitted[canvasId.canvasId];
            delete this.committed[canvasId.canvasId];
        });
    }

    private subscribePixelChangeSubmitted(channel: BaseChannel): void {
        channel.subscribe("canvas:pixelChangeSubmitted", async (data?: Record<string, unknown>) => {
            const pixelChange = data as PixelChangeSubmitted;

            if (!(pixelChange.pixel.canvasId in this.submitted))
            {
                this.submitted[pixelChange.pixel.canvasId] = {};
            }

            this.submitted[pixelChange.pixel.canvasId][pixelChange.transactionId] = pixelChange;

            // Cache not initialised for canvas so assuming load hasn't completed yet
            if (!(pixelChange.pixel.canvasId in this.views))
            {
                return;
            }

            const coords = ViewPlugin.deserialiseCoords(pixelChange.pixel.coords);
            const colours = ViewPlugin.deserialiseColours(pixelChange.pixel.colours);
            const changes = this.diffView(pixelChange.pixel.canvasId, coords, colours);

            if (changes.coords.length !== 0 && changes.colours.length !== 0)
            {
                channel.publish("view:viewChanged", changes);
            }
        });
    }

    private subscribePixelChangeCommitted(channel: BaseChannel): void {
        channel.subscribe("canvas:pixelChangeCommitted", async (data?: Record<string, unknown>) => {
            const pixelChange = data as PixelChangeCommitted;

            if (!(pixelChange.pixel.canvasId in this.committed))
            {
                this.committed[pixelChange.pixel.canvasId] = [];
            }

            this.committed[pixelChange.pixel.canvasId].push(pixelChange);

            // Cache not initialised for canvas so assuming load hasn't completed yet
            if (!(pixelChange.pixel.canvasId in this.views))
            {
                return;
            }

            delete this.submitted[pixelChange.pixel.canvasId][pixelChange.transactionId];

            const coords: number[] = [];
            const colours: number[] = [];

            // TODO: optimise so not passing over all submitted when each pixel is committed
            for (const key in this.submitted[pixelChange.pixel.canvasId])
            {
                const submitted = this.submitted[pixelChange.pixel.canvasId][key];
                coords.concat(ViewPlugin.deserialiseCoords(submitted.pixel.coords));
                colours.concat(ViewPlugin.deserialiseColours(submitted.pixel.colours));
            }

            const changes = this.diffView(pixelChange.pixel.canvasId, coords, colours);

            if (changes.coords.length !== 0 && changes.colours.length !== 0)
            {
                channel.publish("viewChanged", changes);
            }
        });
    }

    private async initialiseView(canvasId: number, channel: BaseChannel): Promise<void> {
        const canvas = await channel.invoke<CanvasResponse|null>("canvas:getCanvas", { canvasId: canvasId });

        if (canvas === null)
        {
            throw new Error(`Failed to query canvas details (${canvasId})`);
        }

        this.views[canvasId] = {
            buffer: Buffer.alloc(Math.ceil((canvas.width * canvas.height) / 2)), // 4 bit colour encoding
            width: canvas.width,
            height: canvas.height,
            view: null,
        };

        for (let height = canvas.startBlockHeight; height <= canvas.endBlockHeight; height++)
        {
            const serialisedBlock = await channel.invoke<string>("app:getBlockByHeight", { height: height }).catch(() => {});

            if (serialisedBlock === undefined)
            {
                break;
            }

            const block = this.codec.decodeBlock(serialisedBlock);

            for (const transaction of block.payload)
            {
                if (transaction.moduleID !== CanvasModule.MODULE_ID ||
                    transaction.assetID !== DrawPixelAsset.ASSET_ID)
                {
                    continue;
                }

                const pixel = transaction.asset as DrawPixelPayloadJSON;

                if (pixel.canvasId !== canvasId)
                {
                    continue;
                }

                const coords = ViewPlugin.deserialiseCoords(Uint8Array.from(Buffer.from(pixel.coords, 'hex')));
                const colours = ViewPlugin.deserialiseColours(Uint8Array.from(Buffer.from(pixel.colours, 'hex')));
                this.diffView(canvasId, coords, colours);
            }
        }
    }

    private diffView(canvasId: number, coords: number[], colours: number[]): ViewChanged {
        const previous: Record<number, number> = {};
        const current: Record<number, number> = {};

        for (let i = 0; i < coords.length; i++)
        {
            const coord = coords[i];
            const colour = colours[i];
            const preUpdate = this.updateView(canvasId, coord, colour);

            if (!(coord in previous))
            {
                previous[coord] = preUpdate;
            }

            current[coord] = colour;
        }

        const modifiedCoords: number[] = [];
        const modifiedColours: number[] = [];

        for (const key in current)
        {
            if (previous[key] !== current[key])
            {
                modifiedCoords.push(Number(key));
                modifiedColours.push(current[key]);
            }
        }

        return {
            canvasId: canvasId,
            coords: ViewPlugin.serialiseCoords(modifiedCoords),
            colours: ViewPlugin.serialiseColours(modifiedColours),
        };
    }

    private updateView(canvasId: number, coord: number, colour: number): number {
        const index = Math.floor(coord / 2);
        const current = this.views[canvasId].buffer.readUInt8(index);
        const offset = (coord % 2) * 4;
        const modified = (current & (0xF0 >> offset)) | (colour << offset);
        this.views[canvasId].buffer.set([modified], index);
        this.views[canvasId].view = null;
        return current;
    }

    private static deserialiseCoords(coords: Uint8Array): number[] {
        return coords.reduce((previousValue: number[], currentValue: number, currentIndex: number) => {
            // 24 bit coordinate packed with little endianness
            const index = Math.floor(currentIndex / 3);
            previousValue[index] = (previousValue[index] ?? 0) | (currentValue << ((currentIndex % 3) * 8));
            return previousValue;
        }, []);
    }

    private static deserialiseColours(colours: Uint8Array): number[] {
        return colours.reduce((previousValue: number[], currentValue: number) => {
            // 4 bit colour encoding (each byte packs two colours)
            previousValue.push(currentValue & 0x0F);
            previousValue.push((currentValue >> 4) & 0x0F);
            return previousValue;
        }, []);
    }

    private static serialiseCoords(coords: number[]): Uint8Array {
        const serialised = coords.reduce((previousValue: number[], currentValue: number) => {
            // 24 bit coordinate packed with little endianness
            previousValue.push(currentValue & 0xFF);
            previousValue.push((currentValue >> 8) & 0xFF);
            previousValue.push((currentValue >> 16) & 0xFF);
            return previousValue;
        }, []);
        return Uint8Array.from(serialised);
    }

    private static serialiseColours(colours: number[]): Uint8Array {
        const serialised = colours.reduce((previousValue: number[], currentValue: number, currentIndex: number) => {
            if (currentIndex % 2)
            {
                // 4 bit colour encoding (each byte packs two colours)
                const lastIndex = previousValue.length - 1;
                previousValue[lastIndex] = previousValue[lastIndex] | ((currentValue & 0x0F) << 4);
                return previousValue;
            }

            previousValue.push(currentValue & 0x0F);
            return previousValue;
        }, []);
        return Uint8Array.from(serialised);
    }
}
