import { strict as assert } from 'assert';
import Jimp from "jimp";
import { cryptography, BaseChannel, EventsDefinition, ActionsDefinition, SchemaWithDefault, BasePlugin, PluginInfo } from "lisk-sdk";
import { PluginOptionsWithAppConfig } from "lisk-framework/dist-node/types";
import { ActivePayload, CanvasId, CanvasResponse, CompletePayload, DrawPixelPayloadJSON } from "../../modules/canvas/schemas";
import { DrawPixelAsset } from "../../modules/canvas/assets/draw_pixel_asset";
import { CanvasModule } from "../../modules/canvas/canvas_module";
import { MysqlConnection } from "../../util/mysql_connection";

interface Config extends PluginOptionsWithAppConfig {
    mysql: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        connectionLimit: number;
    }
}

interface TimelapseSummary {
    timelapseId: number;
    startBlockHeight: number;
    endBlockHeight: number;
    chunkSize: number;
    width: number;
    height: number;
    colourPalette: number[][];
    snapshot: Buffer;
}

interface PrimaryKey {
    id: number;
}

export class TimelapsePlugin extends BasePlugin<Config> {
    private timelapses: Record<number, TimelapseSummary> = {};

    public static get alias(): string {
        return "timelapse";
    }

    public static get info(): PluginInfo {
        return {
            author: "tomilion",
            version: "0.1.0",
            name: TimelapsePlugin.alias,
        };
    }

    public get defaults(): SchemaWithDefault {
        return {
            $id: "#/plugins/timelapse/config",
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
        return {};
    }

    public async load(channel: BaseChannel): Promise<void> {
        const mysql = new MysqlConnection({
            host: this.options.mysql.host,
            port: this.options.mysql.port,
            user: this.options.mysql.user,
            password: this.options.mysql.password,
            database: this.options.mysql.database,
            connectionLimit: this.options.mysql.connectionLimit,
        });
        this.subscribeAppReady(channel, mysql);
        this.subscribeAppBlockNew(channel, mysql);
        this.subscribeCanvasStarted(channel, mysql);
    }

    public async unload(): Promise<void> { }

    private subscribeAppReady(channel: BaseChannel, mysql: MysqlConnection): void {
        channel.subscribe("app:ready", async () => {
            this._logger.info(null, "Initialising timelapse cache");

            let min: number|null = null;
            let max: number|null = null;

            const active = await channel.invoke<ActivePayload>("canvas:getActiveCanvases");
            const complete = await channel.invoke<CompletePayload>("canvas:getCompleteCanvases");

            for (const canvasId of [...active.canvasIds, ...complete.canvasIds]) {
                await this.initialiseTimelapse(canvasId, channel, mysql);
                const timelapse = this.timelapses[canvasId];
                min = Math.min(min ?? timelapse.startBlockHeight, timelapse.startBlockHeight);
                max = Math.max(max ?? timelapse.endBlockHeight, timelapse.endBlockHeight);
            }

            if (min !== null && max !== null) {
                for (let height = min; height <= max; height++) {
                    const serialisedBlock = await channel.invoke<string>("app:getBlockByHeight", { height: height }).catch(() => {});

                    if (serialisedBlock === undefined) {
                        break;
                    }

                    await this.createTransactions(serialisedBlock, mysql);
                }
            }

            for (const canvasId of complete.canvasIds) {
                const updateCompletedSql = "UPDATE timelapse_summaries SET completed = ? WHERE canvas_id = ?";
                await mysql.execute(updateCompletedSql, [1, canvasId]);
                delete this.timelapses[canvasId];
            }

            this._logger.info(null, "Timelapse cache initialised");
        });
    }

    private subscribeAppBlockNew(channel: BaseChannel, mysql: MysqlConnection): void {
        channel.subscribe("app:block:new", async (data?: Record<string, unknown>) => {
            const newBlockEvent = data as { block: string };
            await this.createTransactions(newBlockEvent.block, mysql);
        });
    }

    private subscribeCanvasStarted(channel: BaseChannel, mysql: MysqlConnection): void {
        channel.subscribe("canvas:started", async (data?: Record<string, unknown>) => {
            const canvasId = data as CanvasId;
            await this.initialiseTimelapse(canvasId.canvasId, channel, mysql);
            const timelapse = this.timelapses[canvasId.canvasId];

            for (let height = timelapse.startBlockHeight; height <= timelapse.endBlockHeight; height++) {
                const serialisedBlock = await channel.invoke<string>("app:getBlockByHeight", { height: height }).catch(() => {});

                if (serialisedBlock === undefined) {
                    break;
                }

                await this.createTransactions(serialisedBlock, mysql);
            }
        });
    }

    private async initialiseTimelapse(canvasId: number, channel: BaseChannel, mysql: MysqlConnection): Promise<void> {
        const canvas = await channel.invoke<CanvasResponse|null>("canvas:getCanvas", { canvasId: canvasId });

        if (canvas === null) {
            throw new Error(`Failed to query canvas details (${canvasId})`);
        }

        // TODO: optimise chunk size depending on block height (starting with max 30 chunks)
        const chunkSize = Math.ceil((canvas.endBlockHeight - canvas.startBlockHeight) / 30);
        const colourPalette = Buffer.from(canvas.colourPalette, "hex");
        const summaryId = await this.getOrCreateTimelapseSummary(
            canvasId,
            canvas.startBlockHeight,
            canvas.endBlockHeight,
            chunkSize,
            canvas.width,
            canvas.height,
            colourPalette,
            canvas.label,
            mysql
        );
        this.timelapses[canvasId] = {
            timelapseId: summaryId,
            startBlockHeight: canvas.startBlockHeight,
            endBlockHeight: canvas.endBlockHeight,
            chunkSize: chunkSize,
            width: canvas.width,
            height: canvas.height,
            colourPalette: TimelapsePlugin.deserialiseColourPalette(colourPalette),
            snapshot: Buffer.alloc(Math.ceil((canvas.width * canvas.height) / 2)),
        };
    }

    private async createTransactions(serialisedBlock: string, mysql: MysqlConnection): Promise<void> {
        const block = this.codec.decodeBlock(serialisedBlock);
        const blockIds: Record<number, number> = {};
        const accountIds: Record<string, number> = {};

        for (const canvasId in this.timelapses) {
            const timelapse = this.timelapses[canvasId];

            if (block.header.height < timelapse.startBlockHeight || block.header.height > timelapse.endBlockHeight) {
                continue;
            }

            if (((block.header.height - timelapse.startBlockHeight) % timelapse.chunkSize) === 0) {
                await this.createSnapshot(
                    timelapse.timelapseId,
                    block.header.height,
                    timelapse.snapshot,
                    mysql
                );
                await this.createPreview(
                    timelapse.timelapseId,
                    block.header.height,
                    timelapse.width,
                    timelapse.height,
                    timelapse.colourPalette,
                    timelapse.snapshot,
                    mysql
                );
            }

            if (block.header.height === timelapse.endBlockHeight) {
                await this.createPreview(
                    timelapse.timelapseId,
                    block.header.height,
                    timelapse.width,
                    timelapse.height,
                    timelapse.colourPalette,
                    timelapse.snapshot,
                    mysql
                );

                const updateCompletedSql = "UPDATE timelapse_summaries SET completed = ? WHERE canvas_id = ?";
                await mysql.execute(updateCompletedSql, [1, canvasId]);

                delete this.timelapses[canvasId];
            }
        }

        for (let i = 0; i < block.payload.length; i++) {
            const transaction = block.payload[i];

            if (transaction.moduleID !== CanvasModule.MODULE_ID || transaction.assetID !== DrawPixelAsset.ASSET_ID) {
                continue;
            }

            const pixel = transaction.asset as DrawPixelPayloadJSON;

            if (!(pixel.canvasId in blockIds)) {
                blockIds[pixel.canvasId] = await this.createBlock(pixel.canvasId, block.header.height, mysql);
            }

            if (!(transaction.senderPublicKey in accountIds)) {
                accountIds[transaction.senderPublicKey] = await this.getOrCreateAccount(
                    cryptography.getLisk32AddressFromPublicKey(Buffer.from(transaction.senderPublicKey, "hex")),
                    mysql
                );
            }

            await this.createTransaction(
                accountIds[transaction.senderPublicKey],
                blockIds[pixel.canvasId],
                i,
                Buffer.from(pixel.coords, "hex"),
                Buffer.from(pixel.colours, "hex"),
                mysql
            );

            const coords = TimelapsePlugin.deserialiseCoords(pixel.coords);
            const colours = TimelapsePlugin.deserialiseColours(pixel.colours);

            for (let i = 0; i < coords.length; i++) {
                this.timelapses[pixel.canvasId].snapshot = this.updateView(
                    coords[i],
                    colours[i],
                    this.timelapses[pixel.canvasId].snapshot
                );
            }
        }
    }

    private async getOrCreateTimelapseSummary(
        canvasId: number,
        startBlockHeight: number,
        endBlockHeight: number,
        chunkSize: number,
        width: number,
        height: number,
        colourPalette: Buffer,
        label: string,
        mysql: MysqlConnection
    ): Promise<number> {
        const querySummaryIdSql = "SELECT id FROM timelapse_summaries WHERE canvas_id = ?";
        const existing = await mysql.query<[PrimaryKey]>(querySummaryIdSql, [canvasId]);

        if (existing.length !== 0) {
            return existing.pop().id;
        }

        const createSummarySql = "INSERT INTO timelapse_summaries (canvas_id, start_block_height, end_block_height, chunk_size, width, height, colour_palette, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        await mysql.execute(createSummarySql, [canvasId, startBlockHeight, endBlockHeight, chunkSize, width, height, colourPalette, label]);
        const inserted = await mysql.query<[PrimaryKey]>(querySummaryIdSql, [canvasId]);
        assert(inserted.length !== 0);
        return inserted.pop().id;
    }

    private async createBlock(canvasId: number, blockHeight: number, mysql: MysqlConnection): Promise<number> {
        const queryBlockIdSql = "SELECT id FROM canvas_blocks WHERE canvas_id = ? AND block_height = ?";
        const existing = await mysql.query<[PrimaryKey]>(queryBlockIdSql, [canvasId, blockHeight]);

        if (existing.length !== 0) {
            return existing.pop().id;
        }

        const createBlockSql = "INSERT INTO canvas_blocks (canvas_id, block_height) VALUES (?, ?)";
        await mysql.execute(createBlockSql, [canvasId, blockHeight]);
        const inserted = await mysql.query<[PrimaryKey]>(queryBlockIdSql, [canvasId, blockHeight]);
        assert(inserted.length !== 0);
        return inserted.pop().id;
    }

    private async getOrCreateAccount(address: string, mysql: MysqlConnection): Promise<number> {
        const queryAccountIdSql = "SELECT id FROM canvas_accounts WHERE address = ?";
        const existing = await mysql.query<[PrimaryKey]>(queryAccountIdSql, [address]);

        if (existing.length !== 0) {
            return existing.pop().id;
        }

        const createAccountSql = "INSERT INTO canvas_accounts (address) VALUES (?)";
        await mysql.execute(createAccountSql, [address]);
        const inserted = await mysql.query<[PrimaryKey]>(queryAccountIdSql, [address]);
        assert(inserted.length !== 0);
        return inserted.pop().id;
    }

    private async createTransaction(
        accountId: number,
        blockId: number,
        blockIndex: number,
        coords: Buffer,
        colours: Buffer,
        mysql: MysqlConnection
    ): Promise<void> {
        const queryTransactionSql = "SELECT id FROM canvas_transactions WHERE account_fk = ? AND block_fk = ? AND block_index = ?";
        const existing = await mysql.query<[PrimaryKey]>(queryTransactionSql, [accountId, blockId, blockIndex]);

        if (existing.length !== 0) {
            return;
        }

        const createTransactionSql = "INSERT INTO canvas_transactions (account_fk, block_fk, block_index, coords, colours) VALUES (?, ?, ?, ?, ?)";
        await mysql.execute(createTransactionSql, [accountId, blockId, blockIndex, coords, colours]);
    }

    private async createSnapshot(
        timelapseId: number,
        blockHeight: number,
        snapshot: Buffer,
        mysql: MysqlConnection
    ): Promise<void> {
        const queryTransactionSql = "SELECT id FROM timelapse_snapshots WHERE timelapse_summary_fk = ? AND block_height = ?";
        const existing = await mysql.query<[PrimaryKey]>(queryTransactionSql, [timelapseId, blockHeight]);

        if (existing.length !== 0) {
            return;
        }

        const createSnapshotSql = "INSERT INTO timelapse_snapshots (timelapse_summary_fk, block_height, `snapshot`) VALUES (?, ?, ?)";
        await mysql.execute(createSnapshotSql, [timelapseId, blockHeight, snapshot]);
    }

    private async createPreview(
        timelapseId: number,
        blockHeight: number,
        width: number,
        height: number,
        colourPalette: number[][],
        snapshot: Buffer,
        mysql: MysqlConnection
    ): Promise<void> {
        const queryPreviewSql = "SELECT id FROM timelapse_previews WHERE timelapse_summary_fk = ? AND block_height = ?";
        const existing = await mysql.query<[PrimaryKey]>(queryPreviewSql, [timelapseId, blockHeight]);

        if (existing.length !== 0) {
            return;
        }

        const pngBuffer = Buffer.alloc(width * height * 4);

        for (let i = 0; i < snapshot.length; i++) {
            const current = snapshot.readUInt8(i);
            pngBuffer.set(colourPalette[current & 0x0F], i * 2 * 4);
            pngBuffer.set(colourPalette[(current >> 4) & 0x0F], ((i * 2) + 1) * 4);
        }

        const pngImage = await new Promise<Jimp>((resolve) => {
            new Jimp({ data: pngBuffer, width: width, height: height }, (err, image) => {
                if (err) {
                    throw err;
                }

                resolve(image);
            });
        });
        const preview = await pngImage.getBufferAsync(Jimp.MIME_PNG);
        const createPreviewSql = "INSERT INTO timelapse_previews (timelapse_summary_fk, block_height, preview) VALUES (?, ?, ?)";
        await mysql.execute(createPreviewSql, [timelapseId, blockHeight, preview]);
    }

    private updateView(coord: number, colour: number, buffer: Buffer): Buffer {
        const index = Math.floor(coord / 2);
        const current = buffer.readUInt8(index);
        const offset = (coord % 2) * 4;
        const modified = (current & (0xF0 >> offset)) | (colour << offset);
        buffer.set([modified], index);
        return buffer;
    }

    private static deserialiseColourPalette(colourPalette: Buffer): number[][] {
        return colourPalette.reduce((previousValue: number[][], currentValue: number, currentIndex: number, array: Uint8Array) => {
            if (currentIndex % 3 === 2) {
                previousValue.push([
                    array[currentIndex - 2],
                    array[currentIndex - 1],
                    array[currentIndex],
                    255
                ]);
            }

            return previousValue;
        }, []);
    }

    private static deserialiseCoords(coords: string): number[] {
        return Buffer.from(coords, "hex").reduce((previousValue: number[], currentValue: number, currentIndex: number) => {
            // 24 bit coordinate packed with little endianness
            const index = Math.floor(currentIndex / 3);
            previousValue[index] = (previousValue[index] ?? 0) | (currentValue << ((currentIndex % 3) * 8));
            return previousValue;
        }, []);
    }

    private static deserialiseColours(colours: string): number[] {
        return Buffer.from(colours, "hex").reduce((previousValue: number[], currentValue: number) => {
            // 4 bit colour encoding (each byte packs two colours)
            previousValue.push(currentValue & 0x0F);
            previousValue.push((currentValue >> 4) & 0x0F);
            return previousValue;
        }, []);
    }
}
