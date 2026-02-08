import dotenv from 'dotenv';
import { ethers } from 'hardhat';
import { IExecDataProtector, getWeb3Provider } from '@iexec/dataprotector';
import { IExec } from 'iexec';

dotenv.config({ path: '.env' });

const USDC_50 = 50_000_000n;
const PROCESS_TIMEOUT_MS = Number(process.env.IEXEC_PROCESS_TIMEOUT_MS || '420000');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value === '0x') {
    throw new Error(`Missing ${name} in evm/.env`);
  }
  return value;
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

async function parseResult(buffer: ArrayBuffer): Promise<string> {
  const text = Buffer.from(buffer).toString('utf-8').trim();
  if (text.length > 0) {
    return text;
  }
  return `<binary:${buffer.byteLength}>`;
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

function toBigIntAmount(value: { toString(): string } | string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  return BigInt(value.toString());
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

async function main() {
  const iexecRpc =
    process.env.IEXEC_RPC_URL ||
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.ARBITRUM_RPC_URL ||
    'https://sepolia-rollup.arbitrum.io/rpc';
  const relayPrivateKey = requireEnv('RELAY_PRIVATE_KEY');
  const subscriberPrivateKey = requireEnv('SUBSCRIBER_PRIVATE_KEY');

  const teeApp = await resolveTeeAppAddress(relayPrivateKey, iexecRpc);
  console.log('Using iExec TEE app:', teeApp);

  const [owner, trader] = await ethers.getSigners();

  const mockUSDCFactory = await ethers.getContractFactory('MockUSDC');
  const usdc = await mockUSDCFactory.deploy();
  await usdc.waitForDeployment();

  const hubFactory = await ethers.getContractFactory('ShingoHub');
  const hub = await hubFactory.deploy(await usdc.getAddress(), owner.address);
  await hub.waitForDeployment();

  const subscriber = new ethers.Wallet(subscriberPrivateKey, ethers.provider);

  // Fund local devnet subscriber for tx fees and mint mock USDC for subscription payment.
  await owner.sendTransaction({ to: subscriber.address, value: ethers.parseEther('1') });
  await usdc.mint(subscriber.address, 200_000_000n);

  await hub.connect(trader).registerTrader('tee_trader');
  await hub.connect(trader).openSeason(USDC_50);

  const relayProvider = getWeb3Provider(relayPrivateKey, { host: iexecRpc });
  const relayDp = new IExecDataProtector(relayProvider);
  const relayIexec = new IExec({ ethProvider: relayProvider });

  const payload = {
    market: 'BTC/USDT',
    side: 'BUY',
    entry: 65000,
    stop: 63000,
    takeProfit: 70000,
    leverage: 5
  };

  console.log('Protecting signal in iExec TEE...');
  const protectedData = await relayDp.core.protectData({
    data: payload,
    name: `Shingo Signal ${Date.now()}`
  });
  console.log('ProtectedData address:', protectedData.address);

  await hub.connect(trader).publishSignal(protectedData.address);

  await usdc.connect(subscriber).approve(await hub.getAddress(), USDC_50);
  await hub.connect(subscriber).subscribe(1);

  console.log('Granting subscriber access in iExec...');
  await relayDp.core.grantAccess({
    protectedData: protectedData.address,
    authorizedApp: teeApp,
    authorizedUser: subscriber.address
  });

  const subscriberProvider = getWeb3Provider(subscriberPrivateKey, { host: iexecRpc });
  const subscriberDp = new IExecDataProtector(subscriberProvider);
  const subscriberIexec = new IExec({ ethProvider: subscriberProvider });

  // Discover current order prices for precise maxPrice configuration.
  const [datasetOrderbook, appOrderbook, workerpoolOrderbook, walletBalances, accountBalance] = await Promise.all([
    subscriberIexec.orderbook.fetchDatasetOrderbook({
      dataset: protectedData.address,
      app: teeApp,
      requester: subscriber.address
    }),
    subscriberIexec.orderbook.fetchAppOrderbook({
      app: teeApp,
      minTag: ['tee', 'scone'],
      maxTag: ['tee', 'scone']
    }),
    subscriberIexec.orderbook.fetchWorkerpoolOrderbook({
      app: teeApp,
      dataset: protectedData.address,
      requester: subscriber.address,
      minTag: ['tee', 'scone'],
      category: 0
    }),
    subscriberIexec.wallet.checkBalances(subscriber.address),
    subscriberIexec.account.checkBalance(subscriber.address)
  ]);

  const datasetOrder = datasetOrderbook.orders[0]?.order;
  const appOrder = appOrderbook.orders[0]?.order;
  const workerpoolOrder = workerpoolOrderbook.orders[0]?.order;

  if (!datasetOrder || !appOrder || !workerpoolOrder) {
    throw new Error(
      'No compatible orderbook triplet found (dataset/app/workerpool). Try setting IEXEC_TEE_APP manually.'
    );
  }

  const datasetPrice = Number(datasetOrder.datasetprice.toString());
  const appPrice = Number(appOrder.appprice.toString());
  const workerpoolPrice = Number(workerpoolOrder.workerpoolprice.toString());
  const workerpoolAddress = workerpoolOrder.workerpool.toString();
  const expectedCost = BigInt(datasetPrice + appPrice + workerpoolPrice);

  console.log('iExec wallet nRLC:', walletBalances.nRLC.toString());
  console.log('iExec account stake nRLC:', accountBalance.stake.toString());
  console.log('Expected per-task cost nRLC:', expectedCost.toString());
  console.log('Selected workerpool:', workerpoolAddress);

  await ensureIexecStake(subscriberIexec, subscriber.address, expectedCost, 'subscriber');
  const subscriberAccountAfterTopUp = await subscriberIexec.account.checkBalance(subscriber.address);
  console.log('Subscriber stake after top-up nRLC:', subscriberAccountAfterTopUp.stake.toString());

  let subscriberDecryptOk = false;
  let viewerDecryptOk = false;

  console.log('Processing protected data as subscriber (TEE execution)...');
  try {
    const processed = await withTimeout(
      subscriberDp.core.processProtectedData({
        protectedData: protectedData.address,
        app: teeApp,
        workerpool: workerpoolAddress,
        dataMaxPrice: datasetPrice,
        appMaxPrice: appPrice,
        workerpoolMaxPrice: workerpoolPrice,
        onStatusUpdate: statusLogger('subscriber')
      }),
      PROCESS_TIMEOUT_MS,
      'Subscriber processProtectedData'
    );

    const processedText = await parseResult(processed.result);
    console.log('TEE result preview:', processedText.slice(0, 400));
    subscriberDecryptOk = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Subscriber decrypt step failed:', message);
  }

  await hub.connect(trader).closeSeason();
  console.log('Season closed on ShingoHub.');
  console.log('Signal public on hub:', await hub.isSignalPublic(1));

  console.log('Publicizing signal for all users in iExec...');
  await relayDp.core.grantAccess({
    protectedData: protectedData.address,
    authorizedApp: teeApp,
    authorizedUser: ethers.ZeroAddress,
    allowBulk: true
  });

  const viewer = ethers.Wallet.createRandom();
  await relayIexec.wallet.sendETH(ethers.parseEther('0.005').toString(), viewer.address);
  await relayIexec.wallet.sendRLC((expectedCost * 2n).toString(), viewer.address);

  const viewerProvider = getWeb3Provider(viewer.privateKey, { host: iexecRpc });
  const viewerDp = new IExecDataProtector(viewerProvider);

  console.log('Processing as random viewer after publicize...');
  const viewerIexec = new IExec({ ethProvider: viewerProvider });
  await ensureIexecStake(viewerIexec, viewer.address, expectedCost, 'viewer');
  const viewerAccount = await viewerIexec.account.checkBalance(viewer.address);
  console.log('Viewer account stake nRLC:', viewerAccount.stake.toString());
  try {
    const publicProcessed = await withTimeout(
      viewerDp.core.processProtectedData({
        protectedData: protectedData.address,
        app: teeApp,
        workerpool: workerpoolAddress,
        dataMaxPrice: datasetPrice,
        appMaxPrice: appPrice,
        workerpoolMaxPrice: workerpoolPrice,
        onStatusUpdate: statusLogger('viewer')
      }),
      PROCESS_TIMEOUT_MS,
      'Viewer processProtectedData'
    );
    const publicText = await parseResult(publicProcessed.result);
    console.log('Public result preview:', publicText.slice(0, 400));
    viewerDecryptOk = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Public viewer decrypt step failed:', message);
  }

  console.log('--- E2E SUMMARY ---');
  console.log('Hub:', await hub.getAddress());
  console.log('USDC:', await usdc.getAddress());
  console.log('ProtectedData:', protectedData.address);
  console.log('Trader:', trader.address);
  console.log('Subscriber:', subscriber.address);
  console.log('Viewer:', viewer.address);
  console.log('Subscriber decrypt ok:', subscriberDecryptOk);
  console.log('Viewer decrypt ok:', viewerDecryptOk);
  console.log('E2E run completed.');

  if (!subscriberDecryptOk || !viewerDecryptOk) {
    throw new Error(
      'E2E flow executed but TEE decryption did not complete for all actors. Check workerpool/app availability.'
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('E2E failed:', message);

  if (/insufficient funds|Not enough xRLC|balance|allowance/i.test(message)) {
    console.error(
      'Hint: wallet needs Arbitrum Sepolia ETH/USDC and enough nRLC on the iExec RPC chain (IEXEC_RPC_URL).'
    );
  }

  process.exitCode = 1;
});
