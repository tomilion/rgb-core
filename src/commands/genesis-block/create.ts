import { configDevnet, cryptography, DPoSModule, genesis, KeysModule, passphrase, SequenceModule, TokenModule } from "lisk-sdk";
import { Command, flags as flagParser } from "@oclif/command";
import { SingleBar } from "cli-progress";
import { join, resolve } from "path";
import { existsSync, mkdirSync, writeJSONSync } from "fs-extra";
import { CanvasModule } from "../../app/modules/canvas/canvas_module";
import { AccountType, CanvasAccount } from "../../app/modules/canvas/schemas";

declare type Account<T> = T & {
    passphrase: string
    publicKey: string
    privateKey: string
    address: Buffer
    token: { balance: BigInt }
}

interface DelegateAccount {
    dpos: { delegate: { username: string } }
}

export class GenesisBlockCommand extends Command {
    static description: string = "Creates genesis block file.";
    static examples: string[] = [
        "genesis-block:create --output mydir",
        "genesis-block:create --output mydir --validators 103",
        "genesis-block:create --output mydir --validators 103 --token-distribution 500",
    ];
    static flags: flagParser.Input<any> = {
        output: flagParser.string({
            char: "o",
            description: "Output folder path of the generated genesis block",
            default: "config",
        }),
        validators: flagParser.integer({
            char: "v",
            description: "Number of validator accounts to generate",
            default: 103,
        }),
        "token-distribution": flagParser.integer({
            char: "t",
            description: "Amount of tokens distributed to each account",
            default: 100000000000,
        }),
        "validators-hash-onion-count": flagParser.integer({
            description: "Number of hashes to produce for each hash-onion",
            default: 100000,
        }),
        "validators-hash-onion-distance": flagParser.integer({
            description: "Distance between each hashes for hash-onion",
            default: 1000,
        }),
        "validators-passphrase-encryption-iterations": flagParser.integer({
            description: "Number of iterations to use for passphrase encryption",
            default: 1000000,
        }),
    };

    public async run(): Promise<void> {
        const {
            flags: {
                output,
                validators,
                "token-distribution": tokenDistribution,
                "validators-hash-onion-count": validatorsHashOnionCount,
                "validators-hash-onion-distance": validatorsHashOnionDistance,
                "validators-passphrase-encryption-iterations": validatorsPassphraseEncryptionIterations
            }
        } = this.parse(GenesisBlockCommand);

        const progress = new SingleBar({
            format: "  Creating genesis block |{bar}| {percentage}%",
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true
        });
        progress.start(validators, 0);

        const accounts = [];
        const delegates = [];

        // Create admin account
        accounts.push(this.generateCanvasAccount(AccountType.Admin.toString(), tokenDistribution));

        // Create canvas wallet account
        accounts.push(this.generateCanvasAccount(AccountType.Wallet.toString(), tokenDistribution));

        for (let i = 1; i <= validators; i++)
        {
            delegates.push(this.generateDelegateAccount("delegate_" + i, tokenDistribution));
        }

        const accountAssetSchemas = this.getAccountSchemas();
        const allAccounts = [...delegates, ...accounts];
        const genesisBlockParams = {
            initDelegates: delegates.map(delegate => delegate.address),
            accounts:  allAccounts.map(account => {
                const { publicKey, privateKey, passphrase, ...other } = account;
                return other;
            }),
            accountAssetSchemas: accountAssetSchemas,
        };
        const genesisBlock = genesis.createGenesisBlock(genesisBlockParams);

        const onionSeed = cryptography.generateHashOnionSeed();
        const password = passphrase.Mnemonic.generateMnemonic();
        const passwordList = { defaultPassword: password };
        const delegateForgingInfo = delegates.map(delegate => {
            const info = {
                encryptedPassphrase: cryptography.stringifyEncryptedPassphrase(
                    cryptography.encryptPassphraseWithPassword(
                        delegate.passphrase,
                        password,
                        validatorsPassphraseEncryptionIterations
                    )
                ),
                hashOnion: {
                    count: validatorsHashOnionCount,
                    distance: validatorsHashOnionDistance,
                    hashes: cryptography
                        .hashOnion(onionSeed, validatorsHashOnionCount, validatorsHashOnionDistance)
                        .map(buffer => buffer.toString("hex")),
                },
                address: delegate.address.toString("hex"),
            };
            progress.increment();
            return info;
        });

        progress.stop();

        const configPath = join(process.cwd(), output);
        this.saveFiles(
            configPath,
            genesis.getGenesisBlockJSON({ genesisBlock, accountAssetSchemas }),
            allAccounts.map((account: Account<CanvasAccount & DelegateAccount>) => {
                let other = {};

                if (account.hasOwnProperty("dpos"))
                {
                    other["username"] = account.dpos.delegate.username;
                }

                if (account.hasOwnProperty("canvas"))
                {
                    other["accountType"] = account.canvas.accountType;
                }

                return {
                    passphrase: account.passphrase,
                    address: account.address.toString("hex"),
                    ...other,
                };
            }),
            delegateForgingInfo,
            passwordList
        );
        this.log(`Configuration files saved at: ${configPath}.`);
    }

    private getAccountSchemas(): object
    {
        const token = new TokenModule(configDevnet.genesisConfig).accountSchema;
        const dpos = new DPoSModule(configDevnet.genesisConfig).accountSchema;
        const keys = new KeysModule(configDevnet.genesisConfig).accountSchema;
        const sequence = new SequenceModule(configDevnet.genesisConfig).accountSchema;
        const canvas = new CanvasModule(configDevnet.genesisConfig).accountSchema;
        token["fieldNumber"] = 2;
        dpos["fieldNumber"] = 3;
        keys["fieldNumber"] = 4;
        sequence["fieldNumber"] = 5;
        canvas["fieldNumber"] = 6;
        return {
            token,
            dpos,
            keys,
            sequence,
            canvas,
        };
    }

    private generateDelegateAccount(name: String, balance: number): Account<DelegateAccount> {
        const account = this.generateAccount(balance);
        return {
            ...account,
            dpos: { delegate: { username: name } },
        };
    }

    private generateCanvasAccount(accountType: String, balance: number): Account<CanvasAccount> {
        const account = this.generateAccount(balance);
        return {
            ...account,
            canvas: { accountType: accountType },
        };
    }

    private generateAccount(balance: number): Account<{}> {
        const pass = passphrase.Mnemonic.generateMnemonic();
        const keys = cryptography.getPrivateAndPublicKeyFromPassphrase(pass);
        return {
            passphrase: pass,
            publicKey: keys.publicKey.toString("hex"),
            privateKey: keys.privateKey.toString("hex"),
            address: cryptography.getAddressFromPassphrase(pass),
            token: { balance: BigInt(balance) },
        };
    }

    private saveFiles(
        configPath: string,
        genesisBlock: object,
        accounts: object[],
        delegateForgingInfo: object,
        passwordList: object): void
    {
        if (!existsSync(configPath))
        {
            mkdirSync(configPath, { recursive: true });
        }

        writeJSONSync(resolve(configPath, "genesis_block.json"), genesisBlock, {
            spaces: "    ",
        });
        writeJSONSync(resolve(configPath, "accounts.json"), accounts, {
            spaces: "    ",
        });
        writeJSONSync(resolve(configPath, "forging_info.json"), delegateForgingInfo, {
            spaces: "    ",
        });
        writeJSONSync(resolve(configPath, "password.json"), passwordList, {
            spaces: "    ",
        });
    }
}
