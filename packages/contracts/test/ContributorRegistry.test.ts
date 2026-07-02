import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ContributorRegistry, CrowdstackingPool, MockERC20 } from '../typechain-types';

describe('ContributorRegistry', function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0]!;
    const yieldSource = signers[1]!;
    const contributor1 = signers[2]!;
    const contributor2 = signers[3]!;
    const contributor3 = signers[4]!;
    const other = signers[5]!;

    // Deploy mock pUSD
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const pUSD = (await MockERC20.deploy('pUSD', 'pUSD', 6)) as MockERC20;

    // Deploy CrowdstackingPool
    const CrowdstackingPool = await ethers.getContractFactory('CrowdstackingPool');
    const pool = (await upgrades.deployProxy(
      CrowdstackingPool,
      [owner.address, await pUSD.getAddress(), yieldSource.address],
      { initializer: 'initialize' }
    )) as unknown as CrowdstackingPool;

    // Deploy ContributorRegistry
    const ContributorRegistry = await ethers.getContractFactory('ContributorRegistry');
    const registry = (await upgrades.deployProxy(
      ContributorRegistry,
      [owner.address, await pool.getAddress()],
      { initializer: 'initialize' }
    )) as unknown as ContributorRegistry;

    // Mint tokens for contributions
    const largeAmount = ethers.parseUnits('10000', 6);
    await pUSD.mint(contributor1.address, largeAmount);
    await pUSD.mint(contributor2.address, largeAmount);
    await pUSD.mint(contributor3.address, largeAmount);

    // Approve pool
    await pUSD.connect(contributor1).approve(await pool.getAddress(), largeAmount);
    await pUSD.connect(contributor2).approve(await pool.getAddress(), largeAmount);
    await pUSD.connect(contributor3).approve(await pool.getAddress(), largeAmount);

    // Tier thresholds (in pUSD with 6 decimals)
    const SPARK_AMOUNT = ethers.parseUnits('5', 6); // $5
    const FLAME_AMOUNT = ethers.parseUnits('50', 6); // $50
    const BEACON_AMOUNT = ethers.parseUnits('500', 6); // $500
    const LIGHTHOUSE_AMOUNT = ethers.parseUnits('5000', 6); // $5,000

    return {
      registry,
      pool,
      pUSD,
      owner,
      contributor1,
      contributor2,
      contributor3,
      other,
      SPARK_AMOUNT,
      FLAME_AMOUNT,
      BEACON_AMOUNT,
      LIGHTHOUSE_AMOUNT,
    };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
    });

    it('should set the crowdstacking pool correctly', async function () {
      const { registry, pool } = await loadFixture(deployFixture);
      expect(await registry.crowdstackingPool()).to.equal(await pool.getAddress());
    });
  });

  describe('getTier', function () {
    it('should return NONE for non-contributors', async function () {
      const { registry, contributor1 } = await loadFixture(deployFixture);
      expect(await registry.getTier(contributor1.address)).to.equal(0); // NONE
    });

    it('should return SPARK tier for $5-$49.99', async function () {
      const { registry, pool, contributor1, SPARK_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(SPARK_AMOUNT);

      expect(await registry.getTier(contributor1.address)).to.equal(1); // SPARK
    });

    it('should return FLAME tier for $50-$499.99', async function () {
      const { registry, pool, contributor1, FLAME_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(FLAME_AMOUNT);

      expect(await registry.getTier(contributor1.address)).to.equal(2); // FLAME
    });

    it('should return BEACON tier for $500-$4,999.99', async function () {
      const { registry, pool, contributor1, BEACON_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(BEACON_AMOUNT);

      expect(await registry.getTier(contributor1.address)).to.equal(3); // BEACON
    });

    it('should return LIGHTHOUSE tier for $5,000+', async function () {
      const { registry, pool, contributor1, LIGHTHOUSE_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(LIGHTHOUSE_AMOUNT);

      expect(await registry.getTier(contributor1.address)).to.equal(4); // LIGHTHOUSE
    });
  });

  describe('getGovernanceWeight', function () {
    it('should return 0 for NONE tier', async function () {
      const { registry, contributor1 } = await loadFixture(deployFixture);
      expect(await registry.getGovernanceWeight(contributor1.address)).to.equal(0);
    });

    it('should return 1 for SPARK tier', async function () {
      const { registry, pool, contributor1, SPARK_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(SPARK_AMOUNT);

      expect(await registry.getGovernanceWeight(contributor1.address)).to.equal(1);
    });

    it('should return 3 for FLAME tier', async function () {
      const { registry, pool, contributor1, FLAME_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(FLAME_AMOUNT);

      expect(await registry.getGovernanceWeight(contributor1.address)).to.equal(3);
    });

    it('should return 10 for BEACON tier', async function () {
      const { registry, pool, contributor1, BEACON_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(BEACON_AMOUNT);

      expect(await registry.getGovernanceWeight(contributor1.address)).to.equal(10);
    });

    it('should return 25 for LIGHTHOUSE tier', async function () {
      const { registry, pool, contributor1, LIGHTHOUSE_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(LIGHTHOUSE_AMOUNT);

      expect(await registry.getGovernanceWeight(contributor1.address)).to.equal(25);
    });
  });

  describe('snapshotWeight', function () {
    it('should snapshot contributor weight for a proposal', async function () {
      const { registry, pool, contributor1, BEACON_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(BEACON_AMOUNT);

      const proposalId = 1;

      await expect(registry.snapshotWeight(contributor1.address, proposalId))
        .to.emit(registry, 'WeightSnapshotted')
        .withArgs(proposalId, contributor1.address, 10, 3); // weight=10, tier=BEACON

      expect(await registry.hasSnapshot(proposalId, contributor1.address)).to.be.true;
      expect(await registry.weightSnapshots(proposalId, contributor1.address)).to.equal(10);
    });

    it('should preserve snapshot even if contribution increases', async function () {
      const { registry, pool, contributor1, SPARK_AMOUNT, LIGHTHOUSE_AMOUNT } =
        await loadFixture(deployFixture);

      // Initial contribution - SPARK tier
      await pool.connect(contributor1).contribute(SPARK_AMOUNT);

      const proposalId = 1;
      await registry.snapshotWeight(contributor1.address, proposalId);

      // Snapshot should show SPARK weight (1)
      expect(await registry.getSnapshotWeight(contributor1.address, proposalId)).to.equal(1);

      // Additional contribution - now LIGHTHOUSE tier
      await pool.connect(contributor1).contribute(LIGHTHOUSE_AMOUNT);

      // Current weight should be LIGHTHOUSE (25)
      expect(await registry.getGovernanceWeight(contributor1.address)).to.equal(25);

      // Snapshot should still be SPARK (1)
      expect(await registry.getSnapshotWeight(contributor1.address, proposalId)).to.equal(1);
    });

    it('should revert if snapshot already taken', async function () {
      const { registry, pool, contributor1, SPARK_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(SPARK_AMOUNT);

      const proposalId = 1;
      await registry.snapshotWeight(contributor1.address, proposalId);

      await expect(
        registry.snapshotWeight(contributor1.address, proposalId)
      ).to.be.revertedWithCustomError(registry, 'SnapshotAlreadyTaken');
    });
  });

  describe('getSnapshotWeight', function () {
    it('should return current weight if no snapshot exists', async function () {
      const { registry, pool, contributor1, BEACON_AMOUNT } = await loadFixture(deployFixture);

      await pool.connect(contributor1).contribute(BEACON_AMOUNT);

      const proposalId = 1;
      // No snapshot taken, should return current weight
      expect(await registry.getSnapshotWeight(contributor1.address, proposalId)).to.equal(10);
    });
  });

  describe('View Functions', function () {
    it('getTierForAmount should return correct tier', async function () {
      const { registry, SPARK_AMOUNT, FLAME_AMOUNT, BEACON_AMOUNT, LIGHTHOUSE_AMOUNT } =
        await loadFixture(deployFixture);

      expect(await registry.getTierForAmount(0)).to.equal(0); // NONE
      expect(await registry.getTierForAmount(SPARK_AMOUNT)).to.equal(1); // SPARK
      expect(await registry.getTierForAmount(FLAME_AMOUNT)).to.equal(2); // FLAME
      expect(await registry.getTierForAmount(BEACON_AMOUNT)).to.equal(3); // BEACON
      expect(await registry.getTierForAmount(LIGHTHOUSE_AMOUNT)).to.equal(4); // LIGHTHOUSE
    });

    it('getWeightForTier should return correct weight', async function () {
      const { registry } = await loadFixture(deployFixture);

      expect(await registry.getWeightForTier(0)).to.equal(0); // NONE
      expect(await registry.getWeightForTier(1)).to.equal(1); // SPARK
      expect(await registry.getWeightForTier(2)).to.equal(3); // FLAME
      expect(await registry.getWeightForTier(3)).to.equal(10); // BEACON
      expect(await registry.getWeightForTier(4)).to.equal(25); // LIGHTHOUSE
    });

    it('getTierThresholds should return correct values', async function () {
      const { registry } = await loadFixture(deployFixture);

      const [sparkMin, flameMin, beaconMin, lighthouseMin] = await registry.getTierThresholds();

      expect(sparkMin).to.equal(ethers.parseUnits('5', 6));
      expect(flameMin).to.equal(ethers.parseUnits('50', 6));
      expect(beaconMin).to.equal(ethers.parseUnits('500', 6));
      expect(lighthouseMin).to.equal(ethers.parseUnits('5000', 6));
    });

    it('getTierWeights should return correct values', async function () {
      const { registry } = await loadFixture(deployFixture);

      const [spark, flame, beacon, lighthouse] = await registry.getTierWeights();

      expect(spark).to.equal(1);
      expect(flame).to.equal(3);
      expect(beacon).to.equal(10);
      expect(lighthouse).to.equal(25);
    });
  });

  describe('Admin Functions', function () {
    it('owner can update crowdstacking pool', async function () {
      const { registry, owner, other, pool } = await loadFixture(deployFixture);

      await expect(registry.connect(owner).setCrowdstackingPool(other.address))
        .to.emit(registry, 'CrowdstackingPoolUpdated')
        .withArgs(await pool.getAddress(), other.address);

      expect(await registry.crowdstackingPool()).to.equal(other.address);
    });

    it('should revert on zero address for pool', async function () {
      const { registry, owner } = await loadFixture(deployFixture);

      await expect(
        registry.connect(owner).setCrowdstackingPool(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, 'ZeroAddress');
    });

    it('non-owner cannot update pool', async function () {
      const { registry, other } = await loadFixture(deployFixture);

      await expect(
        registry.connect(other).setCrowdstackingPool(other.address)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');
    });
  });
});
