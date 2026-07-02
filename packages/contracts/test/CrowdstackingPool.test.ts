import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { CrowdstackingPool, MockERC20 } from '../typechain-types';

describe('CrowdstackingPool', function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0]!;
    const yieldSource = signers[1]!;
    const contributor1 = signers[2]!;
    const contributor2 = signers[3]!;
    const other = signers[4]!;

    // Deploy mock pUSD with 6 decimals
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const pUSD = (await MockERC20.deploy('pUSD', 'pUSD', 6)) as MockERC20;

    // Deploy CrowdstackingPool
    const CrowdstackingPool = await ethers.getContractFactory('CrowdstackingPool');
    const pool = (await upgrades.deployProxy(
      CrowdstackingPool,
      [owner.address, await pUSD.getAddress(), yieldSource.address],
      { initializer: 'initialize' }
    )) as unknown as CrowdstackingPool;

    // Mint tokens to contributors
    const mintAmount = ethers.parseUnits('10000', 6); // $10,000
    await pUSD.mint(contributor1.address, mintAmount);
    await pUSD.mint(contributor2.address, mintAmount);
    await pUSD.mint(yieldSource.address, mintAmount);

    // Approve pool
    await pUSD.connect(contributor1).approve(await pool.getAddress(), mintAmount);
    await pUSD.connect(contributor2).approve(await pool.getAddress(), mintAmount);
    await pUSD.connect(yieldSource).approve(await pool.getAddress(), mintAmount);

    return { pool, pUSD, owner, yieldSource, contributor1, contributor2, other };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { pool, owner } = await loadFixture(deployFixture);
      expect(await pool.owner()).to.equal(owner.address);
    });

    it('should set the payment token correctly', async function () {
      const { pool, pUSD } = await loadFixture(deployFixture);
      expect(await pool.paymentToken()).to.equal(await pUSD.getAddress());
    });

    it('should set the yield source correctly', async function () {
      const { pool, yieldSource } = await loadFixture(deployFixture);
      expect(await pool.yieldSource()).to.equal(yieldSource.address);
    });

    it('should start with initial share price of 1:1', async function () {
      const { pool } = await loadFixture(deployFixture);
      expect(await pool.sharePrice()).to.equal(await pool.SHARE_PRECISION());
    });
  });

  describe('contribute', function () {
    it('should accept contributions and issue shares', async function () {
      const { pool, pUSD, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6); // $100

      const balanceBefore = await pUSD.balanceOf(contributor1.address);

      await expect(pool.connect(contributor1).contribute(amount))
        .to.emit(pool, 'Contributed')
        .withArgs(contributor1.address, amount, amount, await pool.SHARE_PRECISION());

      const balanceAfter = await pUSD.balanceOf(contributor1.address);
      expect(balanceBefore - balanceAfter).to.equal(amount);

      const [shares, cumulative] = await pool.getPosition(contributor1.address);
      expect(shares).to.equal(amount); // 1:1 at initial price
      expect(cumulative).to.equal(amount);

      expect(await pool.totalShares()).to.equal(amount);
      expect(await pool.totalAssets()).to.equal(amount);
      expect(await pool.contributorCount()).to.equal(1);
    });

    it('should revert on contribution below minimum', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const belowMin = ethers.parseUnits('4', 6); // $4 (min is $5)

      await expect(pool.connect(contributor1).contribute(belowMin)).to.be.revertedWithCustomError(
        pool,
        'BelowMinimumContribution'
      );
    });

    it('should revert on zero contribution', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);

      await expect(pool.connect(contributor1).contribute(0)).to.be.revertedWithCustomError(
        pool,
        'ZeroAmount'
      );
    });

    it('should calculate correct shares when price changes', async function () {
      const { pool, yieldSource, contributor1, contributor2 } = await loadFixture(deployFixture);

      // Contributor 1 contributes $100
      const amount1 = ethers.parseUnits('100', 6);
      await pool.connect(contributor1).contribute(amount1);

      // Yield received: $10 (10% return)
      const yieldAmount = ethers.parseUnits('10', 6);
      await pool.connect(yieldSource).receiveYield(yieldAmount);

      // New share price should be higher
      const newPrice = await pool.sharePrice();
      expect(newPrice).to.be.gt(await pool.SHARE_PRECISION());

      // Contributor 2 contributes $100 at new price
      const amount2 = ethers.parseUnits('100', 6);
      await pool.connect(contributor2).contribute(amount2);

      // Contributor 2 should get fewer shares
      const [shares2] = await pool.getPosition(contributor2.address);
      expect(shares2).to.be.lt(amount2);
    });
  });

  describe('requestWithdrawal', function () {
    it('should create a withdrawal request', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);

      const tx = await pool.connect(contributor1).requestWithdrawal(amount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const expectedAvailableAt = block!.timestamp + 30 * 24 * 60 * 60;

      await expect(tx)
        .to.emit(pool, 'WithdrawalRequested')
        .withArgs(1, contributor1.address, amount, expectedAvailableAt);

      const request = await pool.getWithdrawalRequest(1);
      expect(request.requester).to.equal(contributor1.address);
      expect(request.shares).to.equal(amount);
      expect(request.status).to.equal(0); // PENDING
    });

    it('should lock shares from position', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      const [shares] = await pool.getPosition(contributor1.address);
      expect(shares).to.equal(0); // All shares locked
    });

    it('should revert if insufficient shares', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);

      await expect(
        pool.connect(contributor1).requestWithdrawal(amount + 1n)
      ).to.be.revertedWithCustomError(pool, 'InsufficientShares');
    });
  });

  describe('completeWithdrawal', function () {
    it('should complete withdrawal after cooldown', async function () {
      const { pool, pUSD, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      // Fast forward past cooldown
      await time.increase(30 * 24 * 60 * 60 + 1);

      const balanceBefore = await pUSD.balanceOf(contributor1.address);

      await expect(pool.connect(contributor1).completeWithdrawal(1))
        .to.emit(pool, 'WithdrawalCompleted')
        .withArgs(1, contributor1.address, amount, amount);

      const balanceAfter = await pUSD.balanceOf(contributor1.address);
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it('should revert before cooldown ends', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      // Try to complete immediately
      await expect(pool.connect(contributor1).completeWithdrawal(1)).to.be.revertedWithCustomError(
        pool,
        'WithdrawalNotReady'
      );
    });

    it('should revert if not requester', async function () {
      const { pool, contributor1, other } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      await time.increase(30 * 24 * 60 * 60 + 1);

      await expect(pool.connect(other).completeWithdrawal(1)).to.be.revertedWithCustomError(
        pool,
        'NotRequester'
      );
    });
  });

  describe('cancelWithdrawal', function () {
    it('should cancel and return shares', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      // Shares should be locked
      let [shares] = await pool.getPosition(contributor1.address);
      expect(shares).to.equal(0);

      await expect(pool.connect(contributor1).cancelWithdrawal(1))
        .to.emit(pool, 'WithdrawalCancelled')
        .withArgs(1, contributor1.address, amount);

      // Shares should be returned
      [shares] = await pool.getPosition(contributor1.address);
      expect(shares).to.equal(amount);

      const request = await pool.getWithdrawalRequest(1);
      expect(request.status).to.equal(2); // CANCELLED
    });

    it('should revert if not requester', async function () {
      const { pool, contributor1, other } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      await expect(pool.connect(other).cancelWithdrawal(1)).to.be.revertedWithCustomError(
        pool,
        'NotRequester'
      );
    });
  });

  describe('receiveYield', function () {
    it('should increase share price', async function () {
      const { pool, yieldSource, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);
      const yieldAmount = ethers.parseUnits('10', 6);

      await pool.connect(contributor1).contribute(amount);

      const priceBefore = await pool.sharePrice();

      await expect(pool.connect(yieldSource).receiveYield(yieldAmount)).to.emit(
        pool,
        'YieldReceived'
      );

      const priceAfter = await pool.sharePrice();
      expect(priceAfter).to.be.gt(priceBefore);

      // Total assets should increase
      expect(await pool.totalAssets()).to.equal(amount + yieldAmount);
    });

    it('should revert if unauthorized', async function () {
      const { pool, other, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);

      await expect(
        pool.connect(other).receiveYield(ethers.parseUnits('10', 6))
      ).to.be.revertedWithCustomError(pool, 'UnauthorizedYieldSource');
    });
  });

  describe('recordLoss', function () {
    it('should decrease share price', async function () {
      const { pool, owner, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);
      const lossAmount = ethers.parseUnits('10', 6);

      await pool.connect(contributor1).contribute(amount);

      const priceBefore = await pool.sharePrice();

      await expect(pool.connect(owner).recordLoss(lossAmount)).to.emit(pool, 'LossRecorded');

      const priceAfter = await pool.sharePrice();
      expect(priceAfter).to.be.lt(priceBefore);

      // Total assets should decrease
      expect(await pool.totalAssets()).to.equal(amount - lossAmount);
    });

    it('should only be callable by owner', async function () {
      const { pool, other, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);

      await expect(
        pool.connect(other).recordLoss(ethers.parseUnits('10', 6))
      ).to.be.revertedWithCustomError(pool, 'OwnableUnauthorizedAccount');
    });
  });

  describe('View Functions', function () {
    it('convertToShares and convertToAssets should be consistent', async function () {
      const { pool, contributor1, yieldSource } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(yieldSource).receiveYield(ethers.parseUnits('10', 6));

      const shares = await pool.convertToShares(amount);
      const assets = await pool.convertToAssets(shares);

      // Should round-trip with minimal precision loss
      expect(assets).to.be.closeTo(amount, 1);
    });

    it('isWithdrawalReady should return correct status', async function () {
      const { pool, contributor1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits('100', 6);

      await pool.connect(contributor1).contribute(amount);
      await pool.connect(contributor1).requestWithdrawal(amount);

      expect(await pool.isWithdrawalReady(1)).to.be.false;

      await time.increase(30 * 24 * 60 * 60 + 1);

      expect(await pool.isWithdrawalReady(1)).to.be.true;
    });
  });

  describe('Admin Functions', function () {
    it('owner can pause and unpause', async function () {
      const { pool, owner } = await loadFixture(deployFixture);

      await pool.connect(owner).pause();
      expect(await pool.paused()).to.be.true;

      await pool.connect(owner).unpause();
      expect(await pool.paused()).to.be.false;
    });

    it('owner can update yield source', async function () {
      const { pool, owner, other } = await loadFixture(deployFixture);

      await expect(pool.connect(owner).setYieldSource(other.address)).to.emit(
        pool,
        'YieldSourceUpdated'
      );

      expect(await pool.yieldSource()).to.equal(other.address);
    });
  });
});
