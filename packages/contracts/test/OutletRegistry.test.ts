import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { OutletRegistry, MockERC20 } from '../typechain-types';

describe('OutletRegistry', function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0]!;
    const governance = signers[1]!;
    const distributor = signers[2]!;
    const outlet1Treasury = signers[3]!;
    const outlet2Treasury = signers[4]!;
    const outlet3Treasury = signers[5]!;
    const other = signers[6]!;

    // Deploy mock pUSD
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const pUSD = (await MockERC20.deploy('pUSD', 'pUSD', 6)) as MockERC20;

    // Deploy OutletRegistry
    const OutletRegistry = await ethers.getContractFactory('OutletRegistry');
    const registry = (await upgrades.deployProxy(
      OutletRegistry,
      [owner.address, await pUSD.getAddress(), governance.address],
      { initializer: 'initialize' }
    )) as unknown as OutletRegistry;

    // Authorize distributor
    await registry.connect(owner).setDistributor(distributor.address, true);

    // Mint tokens for distribution
    const mintAmount = ethers.parseUnits('10000', 6);
    await pUSD.mint(distributor.address, mintAmount);
    await pUSD.connect(distributor).approve(await registry.getAddress(), mintAmount);

    // Create outlet IDs
    const outlet1Id = ethers.keccak256(ethers.toUtf8Bytes('outlet-1'));
    const outlet2Id = ethers.keccak256(ethers.toUtf8Bytes('outlet-2'));
    const outlet3Id = ethers.keccak256(ethers.toUtf8Bytes('outlet-3'));

    return {
      registry,
      pUSD,
      owner,
      governance,
      distributor,
      outlet1Treasury,
      outlet2Treasury,
      outlet3Treasury,
      other,
      outlet1Id,
      outlet2Id,
      outlet3Id,
    };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
    });

    it('should set the governance correctly', async function () {
      const { registry, governance } = await loadFixture(deployFixture);
      expect(await registry.governance()).to.equal(governance.address);
    });

    it('should set the payment token correctly', async function () {
      const { registry, pUSD } = await loadFixture(deployFixture);
      expect(await registry.paymentToken()).to.equal(await pUSD.getAddress());
    });
  });

  describe('addOutlet', function () {
    it('should add an outlet via governance', async function () {
      const { registry, governance, outlet1Treasury, outlet1Id } = await loadFixture(deployFixture);
      const weight = 5000; // 50%

      await expect(
        registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, weight)
      )
        .to.emit(registry, 'OutletAdded')
        .withArgs(outlet1Id, outlet1Treasury.address, weight);

      const outlet = await registry.getOutlet(outlet1Id);
      expect(outlet.treasury).to.equal(outlet1Treasury.address);
      expect(outlet.weight).to.equal(weight);
      expect(outlet.isActive).to.be.true;

      expect(await registry.totalWeight()).to.equal(weight);
    });

    it('should add an outlet via owner', async function () {
      const { registry, owner, outlet1Treasury, outlet1Id } = await loadFixture(deployFixture);

      await expect(
        registry.connect(owner).addOutlet(outlet1Id, outlet1Treasury.address, 5000)
      ).to.emit(registry, 'OutletAdded');
    });

    it('should revert if not governance or owner', async function () {
      const { registry, other, outlet1Treasury, outlet1Id } = await loadFixture(deployFixture);

      await expect(
        registry.connect(other).addOutlet(outlet1Id, outlet1Treasury.address, 5000)
      ).to.be.revertedWithCustomError(registry, 'UnauthorizedGovernance');
    });

    it('should revert if outlet already exists', async function () {
      const { registry, governance, outlet1Treasury, outlet1Id } = await loadFixture(deployFixture);

      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 5000);

      await expect(
        registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 2000)
      ).to.be.revertedWithCustomError(registry, 'OutletAlreadyExists');
    });
  });

  describe('removeOutlet', function () {
    it('should remove an outlet', async function () {
      const { registry, governance, outlet1Treasury, outlet1Id } = await loadFixture(deployFixture);

      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 5000);

      await expect(registry.connect(governance).removeOutlet(outlet1Id))
        .to.emit(registry, 'OutletRemoved')
        .withArgs(outlet1Id, outlet1Treasury.address);

      const outlet = await registry.getOutlet(outlet1Id);
      expect(outlet.isActive).to.be.false;
      expect(outlet.weight).to.equal(0);

      expect(await registry.totalWeight()).to.equal(0);
    });

    it('should revert if outlet not found', async function () {
      const { registry, governance, outlet1Id } = await loadFixture(deployFixture);

      await expect(
        registry.connect(governance).removeOutlet(outlet1Id)
      ).to.be.revertedWithCustomError(registry, 'OutletNotFound');
    });
  });

  describe('updateWeights', function () {
    it('should update weights for multiple outlets', async function () {
      const { registry, governance, outlet1Treasury, outlet2Treasury, outlet1Id, outlet2Id } =
        await loadFixture(deployFixture);

      // Add two outlets
      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 6000);
      await registry.connect(governance).addOutlet(outlet2Id, outlet2Treasury.address, 4000);

      // Update weights
      const newWeight1 = 7000;
      const newWeight2 = 3000;

      await expect(
        registry.connect(governance).updateWeights([outlet1Id, outlet2Id], [newWeight1, newWeight2])
      ).to.emit(registry, 'WeightsUpdated');

      const outlet1 = await registry.getOutlet(outlet1Id);
      const outlet2 = await registry.getOutlet(outlet2Id);

      expect(outlet1.weight).to.equal(newWeight1);
      expect(outlet2.weight).to.equal(newWeight2);
      expect(await registry.totalWeight()).to.equal(10000);
    });

    it('should revert if weights do not sum to BASIS_POINTS', async function () {
      const { registry, governance, outlet1Treasury, outlet2Treasury, outlet1Id, outlet2Id } =
        await loadFixture(deployFixture);

      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 6000);
      await registry.connect(governance).addOutlet(outlet2Id, outlet2Treasury.address, 4000);

      // Try to update with incorrect sum
      await expect(
        registry.connect(governance).updateWeights([outlet1Id, outlet2Id], [5000, 4000])
      ).to.be.revertedWithCustomError(registry, 'WeightSumMismatch');
    });

    it('should revert if array lengths mismatch', async function () {
      const { registry, governance, outlet1Id, outlet2Id } = await loadFixture(deployFixture);

      await expect(
        registry.connect(governance).updateWeights([outlet1Id, outlet2Id], [5000])
      ).to.be.revertedWithCustomError(registry, 'ArrayLengthMismatch');
    });
  });

  describe('distribute', function () {
    it('should distribute funds proportionally', async function () {
      const {
        registry,
        pUSD,
        governance,
        distributor,
        outlet1Treasury,
        outlet2Treasury,
        outlet1Id,
        outlet2Id,
      } = await loadFixture(deployFixture);

      // Add outlets: 60% and 40%
      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 6000);
      await registry.connect(governance).addOutlet(outlet2Id, outlet2Treasury.address, 4000);

      const totalAmount = ethers.parseUnits('1000', 6); // $1,000

      await expect(registry.connect(distributor).distribute(totalAmount))
        .to.emit(registry, 'Distributed')
        .withArgs(totalAmount, 2);

      // Check balances
      expect(await pUSD.balanceOf(outlet1Treasury.address)).to.equal(ethers.parseUnits('600', 6));
      expect(await pUSD.balanceOf(outlet2Treasury.address)).to.equal(ethers.parseUnits('400', 6));

      // Check cumulative tracking
      const outlet1 = await registry.getOutlet(outlet1Id);
      const outlet2 = await registry.getOutlet(outlet2Id);
      expect(outlet1.totalDistributed).to.equal(ethers.parseUnits('600', 6));
      expect(outlet2.totalDistributed).to.equal(ethers.parseUnits('400', 6));
    });

    it('should revert if not authorized distributor', async function () {
      const { registry, other } = await loadFixture(deployFixture);

      await expect(
        registry.connect(other).distribute(ethers.parseUnits('100', 6))
      ).to.be.revertedWithCustomError(registry, 'UnauthorizedDistributor');
    });

    it('should handle no active outlets', async function () {
      const { registry, distributor } = await loadFixture(deployFixture);

      // Should not revert, just do nothing
      await registry.connect(distributor).distribute(ethers.parseUnits('100', 6));
    });
  });

  describe('calculateDistributions', function () {
    it('should return correct distribution amounts', async function () {
      const { registry, governance, outlet1Treasury, outlet2Treasury, outlet1Id, outlet2Id } =
        await loadFixture(deployFixture);

      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 7500);
      await registry.connect(governance).addOutlet(outlet2Id, outlet2Treasury.address, 2500);

      const totalAmount = ethers.parseUnits('1000', 6);
      const [ids, amounts] = await registry.calculateDistributions(totalAmount);

      expect(ids.length).to.equal(2);
      expect(amounts[0]).to.equal(ethers.parseUnits('750', 6));
      expect(amounts[1]).to.equal(ethers.parseUnits('250', 6));
    });
  });

  describe('View Functions', function () {
    it('getOutletIds should return all IDs', async function () {
      const { registry, governance, outlet1Treasury, outlet2Treasury, outlet1Id, outlet2Id } =
        await loadFixture(deployFixture);

      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 5000);
      await registry.connect(governance).addOutlet(outlet2Id, outlet2Treasury.address, 5000);

      const ids = await registry.getOutletIds();
      expect(ids.length).to.equal(2);
      expect(ids).to.include(outlet1Id);
      expect(ids).to.include(outlet2Id);
    });

    it('getActiveOutletCount should return correct count', async function () {
      const { registry, governance, outlet1Treasury, outlet2Treasury, outlet1Id, outlet2Id } =
        await loadFixture(deployFixture);

      await registry.connect(governance).addOutlet(outlet1Id, outlet1Treasury.address, 6000);
      await registry.connect(governance).addOutlet(outlet2Id, outlet2Treasury.address, 4000);

      expect(await registry.getActiveOutletCount()).to.equal(2);

      await registry.connect(governance).removeOutlet(outlet1Id);

      expect(await registry.getActiveOutletCount()).to.equal(1);
    });
  });

  describe('Admin Functions', function () {
    it('owner can update distributor authorization', async function () {
      const { registry, owner, other } = await loadFixture(deployFixture);

      await expect(registry.connect(owner).setDistributor(other.address, true))
        .to.emit(registry, 'DistributorUpdated')
        .withArgs(other.address, true);

      expect(await registry.distributors(other.address)).to.be.true;
    });

    it('owner can update governance', async function () {
      const { registry, owner, other, governance } = await loadFixture(deployFixture);

      await expect(registry.connect(owner).setGovernance(other.address))
        .to.emit(registry, 'GovernanceUpdated')
        .withArgs(governance.address, other.address);

      expect(await registry.governance()).to.equal(other.address);
    });

    it('owner can pause and unpause', async function () {
      const { registry, owner } = await loadFixture(deployFixture);

      await registry.connect(owner).pause();
      expect(await registry.paused()).to.be.true;

      await registry.connect(owner).unpause();
      expect(await registry.paused()).to.be.false;
    });
  });
});
