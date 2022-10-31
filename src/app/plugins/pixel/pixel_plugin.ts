import { BaseChannel, EventsDefinition, ActionsDefinition, SchemaWithDefault, BasePlugin, PluginInfo } from "lisk-sdk";
import { io } from "socket.io-client";
import { ActivePayload } from "../../modules/canvas/schemas";

export class PixelPlugin extends BasePlugin {
    private _channel: BaseChannel|null = null;
    private _cache: number[][][] = [];

    public static get alias(): string {
        return "pixel";
    }

    public static get info(): PluginInfo {
        return {
            author: "tomillion",
            version: "0.1.0.2",
            name: "pixel",
        };
    }

    public get defaults(): SchemaWithDefault {
        return {
            $id: "/plugins/plugin-pixel/config",
            type: "object",
            properties: {},
            required: [],
            default: {},
        };
    }

    public get events(): EventsDefinition {
        return [];
    }

    public get actions(): ActionsDefinition {
        return {
            getAccountBalance: async (params) => {
                const address = Buffer.from(params.address, "hex");
                const account = await this.getChannel().invoke("app:getAccount", { address: address });
                return this.codec.decodeAccount(account);
            },
            testService: async () => {
                const request = async (endpoint, method, params) => new Promise(resolve => {
                    const socket = io(endpoint, { forceNew: true, transports: ["websocket"] });

                    socket.emit("request", { jsonrpc: "2.0", method, params }, answer => {
                        socket.close();
                        resolve(answer);
                    });
                });
                return request("ws://host.docker.internal:9901/rpc-v2", "get.accounts", { "address": "lskzkfw7ofgp3uusknbetemrey4aeatgf2ntbhcds" });
            },
            getPixels: async (params) => {
                if (params.canvasId in this._cache)
                {
                    return this._cache[params.canvasId];
                }

                return null;
            },
        };
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async load(channel: BaseChannel): Promise<void> {
        this._channel = channel;

        this.getChannel().subscribe("app:ready", async () => {
            this._logger.debug(null, "Initialising canvas cache");

            const active = await this.getChannel().invoke<ActivePayload>("canvas:getActiveCanvases");

            for (const canvasId of active.canvasIds ?? [])
            {
                this._cache[canvasId] = await this.getChannel().invoke("canvas:getPixels", { canvasId });
            }

            this._logger.debug(null, "Canvas cache initialised");
        });

        this.getChannel().subscribe("canvas:started", async (data?: Record<string, unknown>) => {
            this._logger.debug(data, "Adding canvas to cache");
            this._cache[data.canvasId] = await this.getChannel().invoke("canvas:getPixels", { canvasId: data.canvasId });
            this._logger.debug(data, "Canvas added to cache");
        });

        this.getChannel().subscribe("canvas:pixelChanged", async (data?: Record<string, unknown>) => {
            this._logger.debug(data, "Updating pixel");
            const x = data.coords & 0x0000FFFF;
            const y = (data.coords & 0xFFFF0000) >> 16;
            this._cache[data.canvasId][y][x] = data.colour;
            this._logger.debug(data, "Pixel updated");
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async unload(): Promise<void> {

    }

    private getChannel(): BaseChannel
    {
        if (this._channel === null)
        {
            throw new Error("Channel not loaded");
        }

        return this._channel;
    }
}
