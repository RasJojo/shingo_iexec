import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ShingoHub', function () {
  async function deployFixture() {
    const [owner, trader, subscriber, relay, stranger] = await ethers.getSigners();

    const mockUSDCFactory = await ethers.getContractFactory('MockUSDC');
    const usdc = await mockUSDCFactory.deploy();
    await usdc.waitForDeployment();

    const shingoFactory = await ethers.getContractFactory('ShingoHub');
    const hub = await shingoFactory.deploy(await usdc.getAddress(), owner.address);
    await hub.waitForDeployment();

    const oneHundred = 100_000_000n; // 100 USDC (6 decimals)
    await usdc.mint(subscriber.address, oneHundred);

    return { hub, usdc, owner, trader, subscriber, relay, stranger };
  }

  it('registers trader with unique pseudo (case-insensitive)', async function () {
    const { hub, trader, stranger } = await deployFixture();

    await expect(hub.connect(trader).registerTrader('Shingo_Alpha'))
      .to.emit(hub, 'TraderRegistered')
      .withArgs(trader.address, 'Shingo_Alpha');

    await expect(hub.connect(stranger).registerTrader('shingo_alpha')).to.be.revertedWithCustomError(
      hub,
      'PseudoTaken'
    );
  });

  it('opens and closes a season', async function () {
    const { hub, trader } = await deployFixture();

    await hub.connect(trader).registerTrader('satoshi-1');

    await expect(hub.connect(trader).openSeason(50_000_000))
      .to.emit(hub, 'SeasonOpened')
      .withArgs(trader.address, 1, 50_000_000);

    const season = await hub.getSeason(1);
    expect(season.id).to.equal(1);
    expect(season.trader).to.equal(trader.address);
    expect(season.priceToken).to.equal(50_000_000);
    expect(season.status).to.equal(0); // OPEN

    await expect(hub.connect(trader).closeSeason())
      .to.emit(hub, 'SeasonClosed')
      .withArgs(trader.address, 1);

    const closed = await hub.getSeason(1);
    expect(closed.status).to.equal(1); // CLOSED

    const profileAfterClose = await hub.getTrader(trader.address);
    expect(profileAfterClose.currentSeasonId).to.equal(0);
  });

  it('publishes signals in active season and paginates', async function () {
    const { hub, trader } = await deployFixture();

    await hub.connect(trader).registerTrader('naka.42');
    await hub.connect(trader).openSeason(25_000_000);

    await expect(hub.connect(trader).publishSignal('0xProtectedDataA'))
      .to.emit(hub, 'SignalPublished')
      .withArgs(trader.address, 1, 1, '0xProtectedDataA');
    await hub.connect(trader).publishSignal('0xProtectedDataB');

    const firstPage = await hub.getSeasonSignals(1, 0, 1);
    expect(firstPage.length).to.equal(1);
    expect(firstPage[0].id).to.equal(1);

    const secondPage = await hub.getSeasonSignals(1, 1, 10);
    expect(secondPage.length).to.equal(1);
    expect(secondPage[0].id).to.equal(2);

    const season = await hub.getSeason(1);
    expect(season.signalCount).to.equal(2);
  });

  it('subscribes to current open season with USDC transfer', async function () {
    const { hub, usdc, trader, subscriber } = await deployFixture();

    await hub.connect(trader).registerTrader('alpha77');
    await hub.connect(trader).openSeason(50_000_000);

    await usdc.connect(subscriber).approve(await hub.getAddress(), 50_000_000);

    await expect(hub.connect(subscriber).subscribe(1))
      .to.emit(hub, 'Subscribed')
      .withArgs(subscriber.address, trader.address, 1, 50_000_000);

    const traderBalance = await usdc.balanceOf(trader.address);
    expect(traderBalance).to.equal(50_000_000);

    const subscription = await hub.getSubscription(subscriber.address, 1);
    expect(subscription.subscriber).to.equal(subscriber.address);
    expect(subscription.seasonId).to.equal(1);
    expect(subscription.amountToken).to.equal(50_000_000);

    expect(await hub.isSubscribed(subscriber.address, 1)).to.equal(true);
  });

  it('allows multiple subscribers on same season', async function () {
    const { hub, usdc, trader, subscriber, stranger } = await deployFixture();

    await hub.connect(trader).registerTrader('multi-sub');
    await hub.connect(trader).openSeason(25_000_000);

    await usdc.mint(stranger.address, 100_000_000n);

    await usdc.connect(subscriber).approve(await hub.getAddress(), 25_000_000);
    await usdc.connect(stranger).approve(await hub.getAddress(), 25_000_000);

    await hub.connect(subscriber).subscribe(1);
    await hub.connect(stranger).subscribe(1);

    expect(await hub.isSubscribed(subscriber.address, 1)).to.equal(true);
    expect(await hub.isSubscribed(stranger.address, 1)).to.equal(true);

    const subscribers = await hub.getSeasonSubscribers(1);
    expect(subscribers.length).to.equal(2);
    expect(subscribers[0]).to.equal(subscriber.address);
    expect(subscribers[1]).to.equal(stranger.address);
  });

  it('prevents double subscription and closed season subscription', async function () {
    const { hub, usdc, trader, subscriber } = await deployFixture();

    await hub.connect(trader).registerTrader('beta99');
    await hub.connect(trader).openSeason(10_000_000);
    await usdc.connect(subscriber).approve(await hub.getAddress(), 100_000_000);

    await hub.connect(subscriber).subscribe(1);

    await expect(hub.connect(subscriber).subscribe(1)).to.be.revertedWithCustomError(hub, 'AlreadySubscribed');

    await hub.connect(trader).closeSeason();
    await expect(hub.connect(subscriber).subscribe(1)).to.be.revertedWithCustomError(hub, 'SeasonNotOpen');
  });

  it('marks all season signals public when season is closed', async function () {
    const { hub, trader } = await deployFixture();

    await hub.connect(trader).registerTrader('gamma_1');
    await hub.connect(trader).openSeason(10_000_000);
    await hub.connect(trader).publishSignal('0xSignalPublic');

    expect(await hub.isSignalPublic(1)).to.equal(false);
    await hub.connect(trader).closeSeason();
    expect(await hub.isSignalPublic(1)).to.equal(true);
  });

  it('supports full lifecycle: trader -> season -> signal -> subscribe -> close -> public', async function () {
    const { hub, usdc, trader, subscriber } = await deployFixture();

    await hub.connect(trader).registerTrader('lifecycle.one');
    await hub.connect(trader).openSeason(42_000_000);
    await hub.connect(trader).publishSignal('0xLifecycleSignal');

    await usdc.connect(subscriber).approve(await hub.getAddress(), 42_000_000);
    await hub.connect(subscriber).subscribe(1);

    expect(await hub.isSubscribed(subscriber.address, 1)).to.equal(true);
    expect(await hub.isSignalPublic(1)).to.equal(false);

    await hub.connect(trader).closeSeason();

    const profile = await hub.getTrader(trader.address);
    expect(profile.currentSeasonId).to.equal(0);
    expect(await hub.isSignalPublic(1)).to.equal(true);
  });

  it('allows owner or relay to link collection id', async function () {
    const { hub, owner, trader, relay, stranger } = await deployFixture();

    await hub.connect(trader).registerTrader('delta-1');
    await hub.connect(trader).openSeason(12_000_000);

    await expect(hub.connect(stranger).setSeasonCollectionId(1, '42')).to.be.revertedWithCustomError(
      hub,
      'Unauthorized'
    );

    await hub.connect(owner).setRelay(relay.address);

    await expect(hub.connect(relay).setSeasonCollectionId(1, '42'))
      .to.emit(hub, 'SeasonCollectionLinked')
      .withArgs(1, '42');

    const season = await hub.getSeason(1);
    expect(season.collectionId).to.equal('42');
  });

  it('updates pseudo while preserving uniqueness constraints', async function () {
    const { hub, trader, stranger } = await deployFixture();

    await hub.connect(trader).registerTrader('omega.one');
    await hub.connect(stranger).registerTrader('theta.one');

    await expect(hub.connect(trader).updatePseudo('theta.one')).to.be.revertedWithCustomError(hub, 'PseudoTaken');

    await expect(hub.connect(trader).updatePseudo('Omega-Two'))
      .to.emit(hub, 'PseudoUpdated')
      .withArgs(trader.address, 'Omega-Two');

    const profile = await hub.getTrader(trader.address);
    expect(profile.pseudo).to.equal('Omega-Two');
  });
});
