import { IExecDataProtector, getWeb3Provider } from '@iexec/dataprotector';
import { ZeroAddress } from 'ethers';

export type SignalPayload = Record<string, string | number | boolean>;

export interface IExecGatewayConfig {
  rpcUrl: string;
  privateKey: string;
  appAddress: string;
}

export interface ProtectedSignal {
  protectedData: string;
  txHash: string;
}

export class IExecTeeGateway {
  private readonly dataProtector: IExecDataProtector;
  private readonly appAddress: string;

  constructor(config: IExecGatewayConfig) {
    const provider = getWeb3Provider(config.privateKey, { host: config.rpcUrl });
    this.dataProtector = new IExecDataProtector(provider);
    this.appAddress = config.appAddress;
  }

  async protectSignal(payload: SignalPayload, name?: string): Promise<ProtectedSignal> {
    const protectedData = await this.dataProtector.core.protectData({
      data: payload,
      name: name ?? 'Shingo Signal'
    });

    return {
      protectedData: protectedData.address,
      txHash: protectedData.transactionHash
    };
  }

  async grantSubscriberAccess(protectedData: string, subscriber: string): Promise<void> {
    await this.grantAccessSafely({
      protectedData,
      authorizedUser: subscriber,
      allowBulk: true
    });
  }

  async publicizeSignal(protectedData: string): Promise<void> {
    await this.grantAccessSafely({
      protectedData,
      authorizedUser: ZeroAddress,
      allowBulk: true
    });
  }

  async processSignal(protectedData: string, path?: string): Promise<ArrayBuffer> {
    const processed = await this.dataProtector.core.processProtectedData({
      protectedData,
      app: this.appAddress,
      path
    });

    return processed.result;
  }

  private async grantAccessSafely(args: {
    protectedData: string;
    authorizedUser: string;
    allowBulk?: boolean;
  }): Promise<void> {
    try {
      await this.dataProtector.core.grantAccess({
        protectedData: args.protectedData,
        authorizedApp: this.appAddress,
        authorizedUser: args.authorizedUser,
        allowBulk: args.allowBulk
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already granted')) {
        return;
      }
      throw error;
    }
  }
}
