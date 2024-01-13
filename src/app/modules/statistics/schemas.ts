export interface TotalTransactionsPayload {
    totalTransactions: number;
}

export const totalTransactionsSchema = {
    $id: "statistics/totalTransactions",
    type: "object",
    required: ["totalTransactions"],
    properties: {
        totalTransactions: { fieldNumber: 1, dataType: "uint32" },
    },
};
