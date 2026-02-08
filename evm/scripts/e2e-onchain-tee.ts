import dotenv from 'dotenv';
import { ethers } from 'hardhat';
import { IExecDataProtector, getWeb3Provider } from '@iexec/dataprotector';
import { IExec } from 'iexec';

dotenv.config({ path: '.env' });

const SUBSCRIPTION_PRICE = BigInt(process.env.E2E_PRICE_USDC || '50000000'); // 50 USDC (6 decimals)
const PROCESS_TIMEOUT_MS = Number(process.env.IEXEC_PROCESS_TIMEOUT_MS || '180000');
const USER_ETH_FUND = process.env.E2E_USER_ETH_FUND || '0.0002';
const IEXEC_ETH_FUND = process.env.E2E_IEXEC_ETH_FUND || '0.0003';
const PROCESS_RETRIES = Number(process.env.IEXEC_PROCESS_RETRIES || '5');
const MIN_TASK_STAKE = BigInt(process.env.IEXEC_MIN_TASK_STAKE || '200000000');
const APPORDER_VOLUME = process.env.IEXEC_APPORDER_VOLUME || '1000000';
const IEXEC_DATA_MAX_PRICE = Number(process.env.IEXEC_DATA_MAX_PRICE || '1000000000');
const IEXEC_APP_MAX_PRICE = Number(process.env.IEXEC_APP_MAX_PRICE || '1000000000');
const IEXEC_WORKERPOOL_MAX_PRICE = Number(process.env.IEXEC_WORKERPOOL_MAX_PRICE || '2000000000');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value === '0x') {
    throw new Error(`Missing ${name} in evm/.env`);
  }
  return value;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function toBigIntAmount(value: { toString(): string } | string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  return BigInt(value.toString());
}

function statusLogger(prefix: string) {
  return (status: { title: string; isDone: boolean; payload?: Record<string, unknown> }) => {
    const state = status.isDone ? 'done' : 'start';
    if (status.payload) {
      console.log(`[${prefix}] ${status.title} (${state})`, status.payload);
    } else {
      console.log(`[${prefix}] ${status.title} (${state})`);
    }
  };
}

async function resolveTeeAppAddress(relayPrivateKey: string, rpcUrl: string): Promise<string> {
  if (process.env.IEXEC_TEE_APP && process.env.IEXEC_TEE_APP !== '0x') {
    return process.env.IEXEC_TEE_APP;
  }

  const provider = getWeb3Provider(relayPrivateKey, { host: rpcUrl });
  const iexec = new IExec({ ethProvider: provider });

  const { orders } = await iexec.orderbook.fetchAppOrderbook({
    app: 'any',
    minTag: ['tee', 'scone'],
    pageSize: 50
  });

  const candidates = [...new Set(orders.map((entry) => entry.order.app.toLowerCase()))];
  if (candidates.length === 0) {
    throw new Error('No TEE app found in iExec orderbook. Set IEXEC_TEE_APP manually in evm/.env');
  }

  for (const app of candidates) {
    const workerpoolForApp = await iexec.orderbook.fetchWorkerpoolOrderbook({
      app,
      dataset: 'any',
      minTag: ['tee', 'scone'],
      category: 0,
      pageSize: 10
    });
    if (workerpoolForApp.orders.length > 0) {
      return app;
    }
  }

  throw new Error('No TEE app with available workerpool order found. Set IEXEC_TEE_APP manually in evm/.env');
}

async function ensureIexecStake(
  iexec: IExec,
  address: string,
  requiredStake: bigint,
  label: string
): Promise<void> {
  const [walletBalances, accountBalance] = await Promise.all([
    iexec.wallet.checkBalances(address),
    iexec.account.checkBalance(address)
  ]);

  const walletNrlc = toBigIntAmount(walletBalances.nRLC);
  const accountStake = toBigIntAmount(accountBalance.stake);

  if (accountStake >= requiredStake) {
    return;
  }

  const missingStake = requiredStake - accountStake;
  if (walletNrlc < missingStake) {
    throw new Error(
      `${label} wallet nRLC (${walletNrlc.toString()}) is below required stake top-up (${missingStake.toString()})`
    );
  }

  console.log(`[${label}] Depositing nRLC to iExec account stake:`, missingStake.toString());
  await iexec.account.deposit(missingStake.toString());
}

async function ensureAppOrderPublished(iexec: IExec, app: string): Promise<void> {
  const existing = await iexec.orderbook.fetchAppOrderbook({
    app,
    minTag: ['tee', 'scone'],
    pageSize: 10
  });

  if (existing.orders.length > 0) {
    console.log('[relay] Existing apporders:', existing.orders.length);
    return;
  }

  const template = await iexec.order.createApporder({
    app,
    appprice: '0',
    volume: APPORDER_VOLUME,
    tag: ['tee', 'scone']
  });
  const signed = await iexec.order.signApporder(template);
  const orderHash = await iexec.order.publishApporder(signed);
  console.log('[relay] Published apporder:', orderHash);
}

function readTextResult(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('utf8').slice(0, 200);
}

async function processAsUser(args: {
  label: string;
  privateKey: string;
  rpcUrl: string;
  protectedData: string;
  app: string;
}): Promise<boolean> {
  const { label, privateKey, rpcUrl, protectedData, app } = args;
  const provider = getWeb3Provider(privateKey, { host: rpcUrl });
  const dp = new IExecDataProtector(provider);
  const iexec = new IExec({ ethProvider: provider });
  const walletAddress = await iexec.wallet.getAddress();
  await ensureIexecStake(iexec, walletAddress, MIN_TASK_STAKE, label);

  let processed: Awaited<ReturnType<typeof dp.core.processProtectedData>> | undefined;
  for (let attempt = 1; attempt <= PROCESS_RETRIES; attempt++) {
    try {
      processed = await withTimeout(
        dp.core.processProtectedData({
          protectedData,
          app,
          dataMaxPrice: IEXEC_DATA_MAX_PRICE,
          appMaxPrice: IEXEC_APP_MAX_PRICE,
          workerpoolMaxPrice: IEXEC_WORKERPOOL_MAX_PRICE,
          onStatusUpdate: statusLogger(label)
        }),
        PROCESS_TIMEOUT_MS,
        `${label} processProtectedData`
      );
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransient = /push protected data encryption key|push requester secret|network|temporar|timeout|503|502|workerpool order|orderbook|task failed|failed to process protected data/i.test(
        message
      );
      if (!isTransient || attempt === PROCESS_RETRIES) {
        throw error;
      }
      console.warn(
        `[${label}] transient processing error (attempt ${attempt}/${PROCESS_RETRIES}): ${message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
  }

  if (!processed) {
    throw new Error(`${label}: processProtectedData did not produce a result`);
  }

  const preview = readTextResult(processed.result);
  console.log(`[${label}] result preview:`, preview);
  return true;
}

async function main() {
  const relayPrivateKey = requireEnv('RELAY_PRIVATE_KEY');
  const arbitrumSepoliaRpc =
    process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
  const iexecRpcUrl = process.env.IEXEC_RPC_URL || arbitrumSepoliaRpc;

  const [deployer] = await ethers.getSigners();
  const trader = deployer;
  const relayWallet = new ethers.Wallet(relayPrivateKey, ethers.provider);
  const subscriber = ethers.Wallet.createRandom().connect(ethers.provider);
  const viewer = ethers.Wallet.createRandom().connect(ethers.provider);

  // ---- Deploy on-chain contracts (Arbitrum Sepolia) ----
  const mockFactory = await ethers.getContractFactory('MockUSDC');
  const usdc = await mockFactory.deploy();
  await usdc.waitForDeployment();

  const hubFactory = await ethers.getContractFactory('ShingoHub');
  const hub = await hubFactory.deploy(await usdc.getAddress(), deployer.address);
  await hub.waitForDeployment();

  await (await hub.setRelay(relayWallet.address)).wait();

  // ---- Fund scenario wallets on Arbitrum Sepolia ----
  await (await trader.sendTransaction({ to: subscriber.address, value: ethers.parseEther(USER_ETH_FUND) })).wait();
  await (await trader.sendTransaction({ to: viewer.address, value: ethers.parseEther(USER_ETH_FUND) })).wait();
  await (await usdc.mint(subscriber.address, SUBSCRIPTION_PRICE * 2n)).wait();

  // ---- Init trader + season ----
  const pseudo = `trader_${Date.now().toString().slice(-8)}`;
  await (await hub.connect(trader).registerTrader(pseudo)).wait();
  await (await hub.connect(trader).openSeason(SUBSCRIPTION_PRICE)).wait();
  const traderProfile = await hub.getTrader(trader.address);
  const seasonId = traderProfile.currentSeasonId;

  console.log('Trader:', trader.address);
  console.log('Subscriber:', subscriber.address);
  console.log('Viewer:', viewer.address);
  console.log('Season ID:', seasonId.toString());
  console.log('Hub:', await hub.getAddress());
  console.log('MockUSDC:', await usdc.getAddress());

  // ---- iExec setup ----
  const teeApp = await resolveTeeAppAddress(relayPrivateKey, iexecRpcUrl);
  console.log('Using iExec TEE app:', teeApp);

  const relayProvider = getWeb3Provider(relayPrivateKey, { host: iexecRpcUrl });
  const relayDp = new IExecDataProtector(relayProvider);
  const relayIexec = new IExec({ ethProvider: relayProvider });
  await ensureAppOrderPublished(relayIexec, teeApp);

  // ---- Protect + publish signal ----
  const payload = {
    market: 'BTC/USDT',
    side: 'BUY',
    entry: 65000,
    stop: 63000,
    takeProfit: 70000,
    leverage: 5,
    ts: Date.now()
  };
  const protectedData = await relayDp.core.protectData({
    data: payload,
    name: `Onchain Signal ${Date.now()}`
  });
  const signalId = await hub.nextSignalId();
  await (await hub.connect(trader).publishSignal(protectedData.address)).wait();

  // ---- Subscribe on-chain ----
  await (await usdc.connect(subscriber).approve(await hub.getAddress(), SUBSCRIPTION_PRICE)).wait();
  await (await hub.connect(subscriber).subscribe(seasonId)).wait();
  const subscribed = await hub.isSubscribed(subscriber.address, seasonId);
  if (!subscribed) {
    throw new Error('Subscription failed on-chain');
  }

  // ---- Grant subscriber access + decrypt ----
  await relayIexec.wallet.sendRLC('300000000', subscriber.address);
  await relayIexec.wallet.sendETH(ethers.parseEther(IEXEC_ETH_FUND).toString(), subscriber.address);
  await relayDp.core.grantAccess({
    protectedData: protectedData.address,
    authorizedApp: teeApp,
    authorizedUser: subscriber.address
  });
  const subscriberOk = await processAsUser({
    label: 'subscriber',
    privateKey: subscriber.privateKey,
    rpcUrl: iexecRpcUrl,
    protectedData: protectedData.address,
    app: teeApp
  });

  // ---- Close season -> signal public on-chain ----
  await (await hub.connect(trader).closeSeason()).wait();
  const isPublic = await hub.isSignalPublic(signalId);
  if (!isPublic) {
    throw new Error('Signal should be public after closeSeason');
  }

  // ---- Publicize on iExec + viewer decrypt ----
  await relayIexec.wallet.sendRLC('300000000', viewer.address);
  await relayIexec.wallet.sendETH(ethers.parseEther(IEXEC_ETH_FUND).toString(), viewer.address);
  await relayDp.core.grantAccess({
    protectedData: protectedData.address,
    authorizedApp: teeApp,
    authorizedUser: ethers.ZeroAddress,
    allowBulk: true
  });
  const viewerOk = await processAsUser({
    label: 'viewer',
    privateKey: viewer.privateKey,
    rpcUrl: iexecRpcUrl,
    protectedData: protectedData.address,
    app: teeApp
  });

  console.log('--- ONCHAIN E2E SUMMARY ---');
  console.log('Hub:', await hub.getAddress());
  console.log('Token:', await usdc.getAddress());
  console.log('Season ID:', seasonId.toString());
  console.log('Signal ID:', signalId.toString());
  console.log('ProtectedData:', protectedData.address);
  console.log('Subscribed:', subscribed);
  console.log('Signal public:', isPublic);
  console.log('Subscriber decrypt ok:', subscriberOk);
  console.log('Viewer decrypt ok:', viewerOk);
  console.log('On-chain E2E completed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('On-chain E2E failed:', message);
  process.exitCode = 1;
});
