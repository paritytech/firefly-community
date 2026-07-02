import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { BountyEscrow } from '../typechain-types';

describe('BountyEscrow', function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0]!;
    const funder = signers[1]!;
    const recipient1 = signers[2]!;
    const recipient2 = signers[3]!;
    const other = signers[4]!;

    const BountyEscrow = await ethers.getContractFactory('BountyEscrow');
    const escrow = (await upgrades.deployProxy(BountyEscrow, [owner.address], {
      initializer: 'initialize',
    })) as unknown as BountyEscrow;

    // Create a bounty ID
    const bountyId = ethers.keccak256(ethers.toUtf8Bytes('bounty-001'));

    // Expiration 30 days from now
    const expiresAt = (await time.latest()) + 30 * 24 * 60 * 60;

    return { escrow, owner, funder, recipient1, recipient2, other, bountyId, expiresAt };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it('should not be paused initially', async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.paused()).to.be.false;
    });
  });

  describe('fundBounty', function () {
    it('should lock native funds correctly', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await expect(
        escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
          value: amount,
        })
      )
        .to.emit(escrow, 'BountyFunded')
        .withArgs(bountyId, funder.address, ethers.ZeroAddress, amount, expiresAt);

      const bounty = await escrow.getBounty(bountyId);
      expect(bounty.funder).to.equal(funder.address);
      expect(bounty.amount).to.equal(amount);
      expect(bounty.status).to.equal(0); // OPEN
    });

    it('should revert if bounty already exists', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      await expect(
        escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
          value: amount,
        })
      ).to.be.revertedWithCustomError(escrow, 'BountyAlreadyExists');
    });

    it('should revert if already expired', async function () {
      const { escrow, funder, bountyId } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');
      const pastExpiration = (await time.latest()) - 1;

      await expect(
        escrow
          .connect(funder)
          .fundBounty(bountyId, ethers.ZeroAddress, amount, pastExpiration, { value: amount })
      ).to.be.revertedWithCustomError(escrow, 'InvalidExpiration');
    });

    it('should revert if native amount mismatch', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(funder)
          .fundBounty(bountyId, ethers.ZeroAddress, ethers.parseEther('1.0'), expiresAt, {
            value: ethers.parseEther('0.5'),
          })
      ).to.be.revertedWithCustomError(escrow, 'InvalidNativeAmount');
    });
  });

  describe('releaseBounty', function () {
    it('should distribute funds to recipients', async function () {
      const { escrow, funder, recipient1, recipient2, bountyId, expiresAt } =
        await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      const r1BalanceBefore = await ethers.provider.getBalance(recipient1.address);
      const r2BalanceBefore = await ethers.provider.getBalance(recipient2.address);

      const allocations = [
        { recipient: recipient1.address, amount: ethers.parseEther('0.6') },
        { recipient: recipient2.address, amount: ethers.parseEther('0.4') },
      ];

      await expect(escrow.connect(funder).releaseBounty(bountyId, allocations))
        .to.emit(escrow, 'BountyReleased')
        .withArgs(bountyId, 2, amount);

      const r1BalanceAfter = await ethers.provider.getBalance(recipient1.address);
      const r2BalanceAfter = await ethers.provider.getBalance(recipient2.address);

      expect(r1BalanceAfter - r1BalanceBefore).to.equal(ethers.parseEther('0.6'));
      expect(r2BalanceAfter - r2BalanceBefore).to.equal(ethers.parseEther('0.4'));

      const bounty = await escrow.getBounty(bountyId);
      expect(bounty.status).to.equal(1); // CLOSED
    });

    it('should revert if not funder', async function () {
      const { escrow, funder, other, recipient1, bountyId, expiresAt } =
        await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      await expect(
        escrow.connect(other).releaseBounty(bountyId, [{ recipient: recipient1.address, amount }])
      ).to.be.revertedWithCustomError(escrow, 'NotFunder');
    });

    it('should revert if allocation mismatch', async function () {
      const { escrow, funder, recipient1, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      await expect(
        escrow.connect(funder).releaseBounty(bountyId, [
          { recipient: recipient1.address, amount: ethers.parseEther('0.5') }, // Only 0.5, not 1.0
        ])
      ).to.be.revertedWithCustomError(escrow, 'AllocationMismatch');
    });

    it('should revert if empty allocations', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      await expect(
        escrow.connect(funder).releaseBounty(bountyId, [])
      ).to.be.revertedWithCustomError(escrow, 'EmptyAllocations');
    });
  });

  describe('cancelBounty', function () {
    it('should return funds to funder', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      const balanceBefore = await ethers.provider.getBalance(funder.address);

      const tx = await escrow.connect(funder).cancelBounty(bountyId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * (receipt!.gasPrice ?? 0n);

      const balanceAfter = await ethers.provider.getBalance(funder.address);

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(amount);

      const bounty = await escrow.getBounty(bountyId);
      expect(bounty.status).to.equal(2); // CANCELLED
    });

    it('should revert if not funder', async function () {
      const { escrow, funder, other, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      await expect(escrow.connect(other).cancelBounty(bountyId)).to.be.revertedWithCustomError(
        escrow,
        'NotFunder'
      );
    });
  });

  describe('claimExpired', function () {
    it('should return funds after expiry', async function () {
      const { escrow, funder, other, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      // Fast forward past expiration
      await time.increaseTo(expiresAt + 1);

      const balanceBefore = await ethers.provider.getBalance(funder.address);

      // Anyone can claim expired bounty
      await expect(escrow.connect(other).claimExpired(bountyId))
        .to.emit(escrow, 'BountyExpired')
        .withArgs(bountyId, amount);

      const balanceAfter = await ethers.provider.getBalance(funder.address);

      // Funds go to original funder, not caller
      expect(balanceAfter - balanceBefore).to.equal(amount);

      const bounty = await escrow.getBounty(bountyId);
      expect(bounty.status).to.equal(3); // EXPIRED
    });

    it('should revert if not expired yet', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      await expect(escrow.claimExpired(bountyId)).to.be.revertedWithCustomError(
        escrow,
        'BountyNotExpired'
      );
    });
  });

  describe('View Functions', function () {
    it('bountyExists returns correct values', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      expect(await escrow.bountyExists(bountyId)).to.be.false;

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      expect(await escrow.bountyExists(bountyId)).to.be.true;
    });

    it('isExpired returns correct values', async function () {
      const { escrow, funder, bountyId, expiresAt } = await loadFixture(deployFixture);
      const amount = ethers.parseEther('1.0');

      await escrow.connect(funder).fundBounty(bountyId, ethers.ZeroAddress, amount, expiresAt, {
        value: amount,
      });

      expect(await escrow.isExpired(bountyId)).to.be.false;

      await time.increaseTo(expiresAt + 1);

      expect(await escrow.isExpired(bountyId)).to.be.true;
    });
  });

  describe('Admin Functions', function () {
    it('owner can pause and unpause', async function () {
      const { escrow, owner } = await loadFixture(deployFixture);

      await escrow.connect(owner).pause();
      expect(await escrow.paused()).to.be.true;

      await escrow.connect(owner).unpause();
      expect(await escrow.paused()).to.be.false;
    });

    it('non-owner cannot pause', async function () {
      const { escrow, other } = await loadFixture(deployFixture);

      await expect(escrow.connect(other).pause()).to.be.revertedWithCustomError(
        escrow,
        'OwnableUnauthorizedAccount'
      );
    });
  });
});
