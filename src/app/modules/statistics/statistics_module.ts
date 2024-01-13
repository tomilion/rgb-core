import { AfterBlockApplyContext, AfterGenesisBlockApplyContext, BaseModule, BeforeBlockApplyContext, codec, TransactionApplyContext } from "lisk-sdk";
import { TotalTransactionsPayload, totalTransactionsSchema } from "./schemas";

export class StatisticsModule extends BaseModule {
    public static readonly MODULE_ID = 2000;

    public name = "statistics";
    public id = StatisticsModule.MODULE_ID;
    public actions = {
        getTotalTransactions: async () => this.getTotalTransactions(),
    };
    public reducers = {};
    public transactionAssets = [];
    public events = [];

    public async beforeBlockApply(_input: BeforeBlockApplyContext): Promise<void> {
        // Do nothing
    }

    public async afterBlockApply(context: AfterBlockApplyContext): Promise<void> {
        const { block, stateStore } = context;
        const totalBuffer = await stateStore.chain.get("statistics:totalTransactions");
        const current = this.decodeTotalTransactions(totalBuffer);
        await stateStore.chain.set("statistics:totalTransactions", codec.encode(totalTransactionsSchema, { totalTransactions: current + block.payload.length }));
    }

    public async beforeTransactionApply(_input: TransactionApplyContext): Promise<void> {
        // Do nothing
    }

    public async afterTransactionApply(_input: TransactionApplyContext): Promise<void> {
        // Do nothing
    }

    public async afterGenesisBlockApply(_input: AfterGenesisBlockApplyContext): Promise<void> {
        // Do nothing
    }

    private async getTotalTransactions(): Promise<number> {
        const totalBuffer = await this._dataAccess.getChainState("statistics:totalTransactions");
        return this.decodeTotalTransactions(totalBuffer);
    }

    private decodeTotalTransactions(buffer: Buffer|undefined): number {
        if (buffer === undefined)
        {
            return 0;
        }

        return codec.decode<TotalTransactionsPayload>(totalTransactionsSchema, buffer).totalTransactions;
    }
}
