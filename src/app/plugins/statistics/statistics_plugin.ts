import { ActionsDefinition, BaseChannel, BasePlugin, cryptography, EventsDefinition, PluginInfo, SchemaWithDefault } from "lisk-sdk";
import { PluginOptionsWithAppConfig } from "lisk-framework/dist-node/types";
import { DrawPixelPayloadJSON } from "../../modules/canvas/schemas";
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

export class StatisticsPlugin extends BasePlugin<Config> {
    public static get alias(): string {
        return "statistics";
    }

    public static get info(): PluginInfo {
        return {
            author: "tomilion",
            version: "0.1.0",
            name: StatisticsPlugin.alias,
        };
    }

    public get defaults(): SchemaWithDefault {
        return {
            $id: "#/plugins/statistics/config",
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
    }

    public async unload(): Promise<void> { }

    private subscribeAppReady(channel: BaseChannel, mysql: MysqlConnection): void {
        channel.subscribe("app:ready", async () => {
            this._logger.info(null, "Initialising statistics cache");

            const queryLastBlockSql = "SELECT MAX(block_height) AS lastBlock FROM transaction_summaries";
            const lastBlock = await mysql.query<[{ lastBlock: number }]>(queryLastBlockSql);

            if (!lastBlock) {
                throw new Error("Failed to query last block height");
            }

            for (let height = lastBlock[lastBlock.length - 1].lastBlock; ; height++) {
                const serialisedBlock = await channel.invoke<string>("app:getBlockByHeight", { height: height }).catch(() => {});

                if (!serialisedBlock) {
                    break;
                }

                await this.createTransactions(serialisedBlock, mysql);
            }

            this._logger.info(null, "Statistics cache initialised");
        });
    }

    private subscribeAppBlockNew(channel: BaseChannel, mysql: MysqlConnection): void {
        channel.subscribe("app:block:new", async (data?: Record<string, unknown>) => {
            const newBlockEvent = data as { block: string };
            await this.createTransactions(newBlockEvent.block, mysql);
        });
    }

    private async createTransactions(serialisedBlock: string, mysql: MysqlConnection): Promise<void> {
        const block = this.codec.decodeBlock(serialisedBlock);
        let transactions = [];

        for (let i = 0; i < block.payload.length; i++)
        {
            const transaction = block.payload[i];
            const schema = this.findSchema(transaction.moduleID, transaction.assetID);

            transactions.push({
                transactionId: transaction.id,
                senderAddress: cryptography.getLisk32AddressFromPublicKey(Buffer.from(transaction.senderPublicKey, "hex")),
                moduleName: schema.moduleName,
                assetName: schema.assetName,
                fee: transaction.fee,
                blockHeight: block.header.height,
            });
        }

        if (transactions.length === 0) {
            return;
        }

        let createTransactionsSql = `
            INSERT INTO transaction_summaries (
                transaction_id,
                sender_address,
                module_name,
                asset_name,
                fee,
                block_height
            ) VALUES ${transactions.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}
            ON DUPLICATE KEY UPDATE transaction_id=transaction_id
        `;
        await mysql.execute(
            createTransactionsSql,
            transactions.map((transaction) => [
                    transaction.transactionId,
                    transaction.senderAddress,
                    transaction.moduleName,
                    transaction.assetName,
                    transaction.fee,
                    transaction.blockHeight,
                ])
                .reduce((prev, current) => prev.concat(current))
        );
    }

    private findSchema(moduleId: number, assetId: number): { moduleName: string, assetName: string } {
        for (const schema of this.schemas.transactionsAssets) {
            if (schema.moduleID === moduleId && schema.assetID === assetId) {
                return schema;
            }
        }

        throw new Error(`Failed to find schema (${moduleId}:${assetId})`);
    }
}
