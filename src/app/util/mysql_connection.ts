import { createPool, Pool, PoolConfig } from "mysql";

export class MysqlConnection {
    private pool: Pool;

    public constructor(config: PoolConfig) {
        this.pool = createPool(config);
    }

    public execute(query: string, params: string[] | Object = {}): Promise<void> {
        return this.query<void>(query, params);
    }

    public query<T>(query: string, params: string[] | Object = {}): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.pool.query(query, params, (error, results) => {
                if (error)
                {
                    reject(error);
                }
                else
                {
                    resolve(results);
                }
            });
        });
    }
}
