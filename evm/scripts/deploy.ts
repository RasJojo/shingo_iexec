import dotenv from 'dotenv';
import { ethers } from 'hardhat';

dotenv.config({ path: '.env' });

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isLocalDevnet = chainId === 31337;
  const localUseMockToken = process.env.LOCAL_USE_MOCK_TOKEN !== 'false';
  let paymentToken = process.env.PAYMENT_TOKEN_ADDRESS;

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      'No deployer account configured. Set DEPLOYER_PRIVATE_KEY in evm/.env for non-local networks.'
    );
  }
  const deployer = signers[0];
  console.log('Deployer:', deployer.address);
  console.log('Network:', network.name, chainId);

  if ((isLocalDevnet && localUseMockToken) || !paymentToken) {
    if (!isLocalDevnet) {
      throw new Error('PAYMENT_TOKEN_ADDRESS is required in evm/.env for non-local networks');
    }
    const mockFactory = await ethers.getContractFactory('MockUSDC');
    const mock = await mockFactory.deploy();
    await mock.waitForDeployment();
    paymentToken = await mock.getAddress();
    console.log('MockUSDC deployed at:', paymentToken);
  }

  console.log('Payment token:', paymentToken);

  const factory = await ethers.getContractFactory('ShingoHub');
  const hub = await factory.deploy(paymentToken, deployer.address);
  await hub.waitForDeployment();

  const hubAddress = await hub.getAddress();
  console.log('ShingoHub deployed at:', hubAddress);

  const relay = process.env.RELAY_PRIVATE_KEY;
  if (relay && relay !== '0x') {
    const wallet = new ethers.Wallet(relay, ethers.provider);
    const tx = await hub.setRelay(wallet.address);
    await tx.wait();
    console.log('Relay set to:', wallet.address);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
