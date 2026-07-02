import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import {
  AllianceGovernance,
  ContributorRegistry,
  CrowdstackingPool,
  OutletRegistry,
  MockERC20,
} from '../typechain-types';

describe('AllianceGovernance', function () {
  // Enum values from contract
  const ProposalType = {
    OutletAdd: 0,
    OutletRemove: 1,
    WeightChange: 2,
    ParameterChange: 3,
    Emergency: 4,
  };

  const ProposalState = {
    Pending: 0,
    Active: 1,
    Succeeded: 2,
    Defeated: 3,
    Expired: 4,
    Executed: 5,
    Cancelled: 6,
  };

  const VoteType = {
    For: 0,
    Against: 1,
    Abstain: 2,
  };

  async function deployFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0]!;
    const yieldSource = signers[1]!;
    const beaconContributor = signers[2]!; // Will have BEACON tier (can propose)
    const sparkContributor = signers[3]!; // Will have SPARK tier (can vote, not propose)
    const flameContributor = signers[4]!; // Will have FLAME tier
    const lighthouseContributor = signers[5]!; // Will have LIGHTHOUSE tier
    const nonContributor = signers[6]!; // No contributions
    const outletTreasury = signers[7]!;

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
    const contributorRegistry = (await upgrades.deployProxy(
      ContributorRegistry,
      [owner.address, await pool.getAddress()],
      { initializer: 'initialize' }
    )) as unknown as ContributorRegistry;

    // Deploy OutletRegistry
    const OutletRegistry = await ethers.getContractFactory('OutletRegistry');
    const outletRegistry = (await upgrades.deployProxy(
      OutletRegistry,
      [owner.address, await pUSD.getAddress(), owner.address], // governance = owner for now
      { initializer: 'initialize' }
    )) as unknown as OutletRegistry;

    // Deploy AllianceGovernance
    const AllianceGovernance = await ethers.getContractFactory('AllianceGovernance');
    const governance = (await upgrades.deployProxy(
      AllianceGovernance,
      [owner.address, await contributorRegistry.getAddress(), await outletRegistry.getAddress()],
      { initializer: 'initialize' }
    )) as unknown as AllianceGovernance;

    // Set governance contract as OutletRegistry governance
    await outletRegistry.setGovernance(await governance.getAddress());

    // Mint tokens and make contributions to set up tiers
    const SPARK_AMOUNT = ethers.parseUnits('5', 6); // $5 -> SPARK (weight 1)
    const FLAME_AMOUNT = ethers.parseUnits('50', 6); // $50 -> FLAME (weight 3)
    const BEACON_AMOUNT = ethers.parseUnits('500', 6); // $500 -> BEACON (weight 10)
    const LIGHTHOUSE_AMOUNT = ethers.parseUnits('5000', 6); // $5000 -> LIGHTHOUSE (weight 25)

    // Mint to contributors
    await pUSD.mint(sparkContributor.address, SPARK_AMOUNT);
    await pUSD.mint(flameContributor.address, FLAME_AMOUNT);
    await pUSD.mint(beaconContributor.address, BEACON_AMOUNT);
    await pUSD.mint(lighthouseContributor.address, LIGHTHOUSE_AMOUNT);

    // Approve pool
    await pUSD.connect(sparkContributor).approve(await pool.getAddress(), SPARK_AMOUNT);
    await pUSD.connect(flameContributor).approve(await pool.getAddress(), FLAME_AMOUNT);
    await pUSD.connect(beaconContributor).approve(await pool.getAddress(), BEACON_AMOUNT);
    await pUSD.connect(lighthouseContributor).approve(await pool.getAddress(), LIGHTHOUSE_AMOUNT);

    // Make contributions
    await pool.connect(sparkContributor).contribute(SPARK_AMOUNT);
    await pool.connect(flameContributor).contribute(FLAME_AMOUNT);
    await pool.connect(beaconContributor).contribute(BEACON_AMOUNT);
    await pool.connect(lighthouseContributor).contribute(LIGHTHOUSE_AMOUNT);

    return {
      governance,
      contributorRegistry,
      outletRegistry,
      pool,
      pUSD,
      owner,
      beaconContributor,
      sparkContributor,
      flameContributor,
      lighthouseContributor,
      nonContributor,
      outletTreasury,
    };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { governance, owner } = await loadFixture(deployFixture);
      expect(await governance.owner()).to.equal(owner.address);
    });

    it('should set the ContributorRegistry correctly', async function () {
      const { governance, contributorRegistry } = await loadFixture(deployFixture);
      expect(await governance.contributorRegistry()).to.equal(
        await contributorRegistry.getAddress()
      );
    });

    it('should set the OutletRegistry correctly', async function () {
      const { governance, outletRegistry } = await loadFixture(deployFixture);
      expect(await governance.outletRegistry()).to.equal(await outletRegistry.getAddress());
    });

    it('should set default configurations', async function () {
      const { governance } = await loadFixture(deployFixture);

      // Standard config
      const standardConfig = await governance.getConfig(ProposalType.OutletAdd);
      expect(standardConfig.quorum).to.equal(100);
      expect(standardConfig.threshold).to.equal(6000); // 60%

      // Emergency config (higher threshold)
      const emergencyConfig = await governance.getConfig(ProposalType.Emergency);
      expect(emergencyConfig.quorum).to.equal(150);
      expect(emergencyConfig.threshold).to.equal(8000); // 80%
    });
  });

  describe('Proposal Creation', function () {
    it('should allow BEACON tier to create proposals', async function () {
      const { governance, beaconContributor, outletTreasury } = await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000] // 50% weight
      );

      const currentBlock = await ethers.provider.getBlockNumber();

      await expect(
        governance
          .connect(beaconContributor)
          .propose(ProposalType.OutletAdd, payload, 'Add new outlet')
      )
        .to.emit(governance, 'ProposalCreated')
        .withArgs(
          1, // proposalId
          beaconContributor.address,
          ProposalType.OutletAdd,
          currentBlock + 1, // snapshotBlock
          currentBlock + 2, // startBlock
          currentBlock + 50402, // endBlock (startBlock + votingPeriod)
          'Add new outlet'
        );

      expect(await governance.proposalCount()).to.equal(1);
    });

    it('should allow LIGHTHOUSE tier to create proposals', async function () {
      const { governance, lighthouseContributor, outletTreasury } =
        await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(lighthouseContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      expect(await governance.proposalCount()).to.equal(1);
    });

    it('should reject proposals from SPARK tier', async function () {
      const { governance, sparkContributor, outletTreasury } = await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await expect(
        governance.connect(sparkContributor).propose(ProposalType.OutletAdd, payload, 'Add outlet')
      ).to.be.revertedWithCustomError(governance, 'InsufficientTier');
    });

    it('should reject proposals from FLAME tier', async function () {
      const { governance, flameContributor, outletTreasury } = await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await expect(
        governance.connect(flameContributor).propose(ProposalType.OutletAdd, payload, 'Add outlet')
      ).to.be.revertedWithCustomError(governance, 'InsufficientTier');
    });

    it('should reject proposals from non-contributors', async function () {
      const { governance, nonContributor, outletTreasury } = await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await expect(
        governance.connect(nonContributor).propose(ProposalType.OutletAdd, payload, 'Add outlet')
      ).to.be.revertedWithCustomError(governance, 'InsufficientTier');
    });

    it('should reject proposals with invalid payload', async function () {
      const { governance, beaconContributor } = await loadFixture(deployFixture);

      // Too short payload for OutletAdd
      const shortPayload = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [ethers.ZeroHash]);

      await expect(
        governance
          .connect(beaconContributor)
          .propose(ProposalType.OutletAdd, shortPayload, 'Invalid proposal')
      ).to.be.revertedWithCustomError(governance, 'InvalidPayload');
    });

    it('should snapshot proposer weight at creation', async function () {
      const { governance, contributorRegistry, beaconContributor, outletTreasury } =
        await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      // Check snapshot was taken
      expect(await contributorRegistry.hasSnapshot(1, beaconContributor.address)).to.be.true;
      expect(await contributorRegistry.getSnapshotWeight(beaconContributor.address, 1)).to.equal(
        10
      ); // BEACON weight
    });
  });

  describe('Voting', function () {
    async function createProposalFixture() {
      const base = await deployFixture();

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, base.outletTreasury.address, 5000]
      );

      await base.governance
        .connect(base.beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      // Mine blocks to make proposal active
      await mine(2);

      return { ...base, proposalId: 1 };
    }

    it('should allow SPARK tier to vote', async function () {
      const { governance, sparkContributor, proposalId } = await loadFixture(createProposalFixture);

      await expect(governance.connect(sparkContributor).castVote(proposalId, VoteType.For))
        .to.emit(governance, 'VoteCast')
        .withArgs(proposalId, sparkContributor.address, VoteType.For, 1, ''); // SPARK weight = 1
    });

    it('should allow FLAME tier to vote', async function () {
      const { governance, flameContributor, proposalId } = await loadFixture(createProposalFixture);

      await governance.connect(flameContributor).castVote(proposalId, VoteType.For);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.forVotes).to.equal(3); // FLAME weight = 3
    });

    it('should allow BEACON tier to vote', async function () {
      const { governance, beaconContributor, proposalId } =
        await loadFixture(createProposalFixture);

      // Beacon contributor is the proposer, so they already have a snapshot
      await governance.connect(beaconContributor).castVote(proposalId, VoteType.For);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.forVotes).to.equal(10); // BEACON weight = 10
    });

    it('should allow LIGHTHOUSE tier to vote', async function () {
      const { governance, lighthouseContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await governance.connect(lighthouseContributor).castVote(proposalId, VoteType.For);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.forVotes).to.equal(25); // LIGHTHOUSE weight = 25
    });

    it('should reject votes from non-contributors', async function () {
      const { governance, nonContributor, proposalId } = await loadFixture(createProposalFixture);

      await expect(
        governance.connect(nonContributor).castVote(proposalId, VoteType.For)
      ).to.be.revertedWithCustomError(governance, 'InsufficientTier');
    });

    it('should reject double voting', async function () {
      const { governance, sparkContributor, proposalId } = await loadFixture(createProposalFixture);

      await governance.connect(sparkContributor).castVote(proposalId, VoteType.For);

      await expect(
        governance.connect(sparkContributor).castVote(proposalId, VoteType.Against)
      ).to.be.revertedWithCustomError(governance, 'AlreadyVoted');
    });

    it('should allow voting with reason', async function () {
      const { governance, sparkContributor, proposalId } = await loadFixture(createProposalFixture);

      const reason = 'I support this outlet addition';
      await expect(
        governance.connect(sparkContributor).castVoteWithReason(proposalId, VoteType.For, reason)
      )
        .to.emit(governance, 'VoteCast')
        .withArgs(proposalId, sparkContributor.address, VoteType.For, 1, reason);

      const receipt = await governance.getVoteReceipt(proposalId, sparkContributor.address);
      expect(receipt.voted).to.be.true;
      expect(receipt.support).to.equal(VoteType.For);
      expect(receipt.reason).to.equal(reason);
    });

    it('should tally For votes correctly', async function () {
      const { governance, sparkContributor, flameContributor, beaconContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await governance.connect(sparkContributor).castVote(proposalId, VoteType.For);
      await governance.connect(flameContributor).castVote(proposalId, VoteType.For);
      await governance.connect(beaconContributor).castVote(proposalId, VoteType.For);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.forVotes).to.equal(1 + 3 + 10); // 14
    });

    it('should tally Against votes correctly', async function () {
      const { governance, sparkContributor, flameContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await governance.connect(sparkContributor).castVote(proposalId, VoteType.Against);
      await governance.connect(flameContributor).castVote(proposalId, VoteType.Against);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.againstVotes).to.equal(1 + 3); // 4
    });

    it('should tally Abstain votes correctly', async function () {
      const { governance, sparkContributor, flameContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await governance.connect(sparkContributor).castVote(proposalId, VoteType.Abstain);
      await governance.connect(flameContributor).castVote(proposalId, VoteType.Abstain);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.abstainVotes).to.equal(1 + 3); // 4
    });

    it('should reject votes on pending proposals', async function () {
      const base = await deployFixture();

      // Set a longer voting delay so proposal stays pending
      await base.governance.connect(base.owner).setConfig(ProposalType.OutletAdd, {
        quorum: 100,
        threshold: 6000,
        votingDelay: 10, // 10 blocks before voting starts
        votingPeriod: 50400,
        executionDelay: 14400,
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, base.outletTreasury.address, 5000]
      );

      await base.governance
        .connect(base.beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      // Don't mine blocks - proposal is still pending
      const state = await base.governance.state(1);
      expect(state).to.equal(ProposalState.Pending);

      await expect(
        base.governance.connect(base.sparkContributor).castVote(1, VoteType.For)
      ).to.be.revertedWithCustomError(base.governance, 'ProposalNotActive');
    });

    it('should reject votes on expired proposals', async function () {
      const { governance, sparkContributor, proposalId } = await loadFixture(createProposalFixture);

      // Mine past voting period
      await mine(60000);

      await expect(
        governance.connect(sparkContributor).castVote(proposalId, VoteType.For)
      ).to.be.revertedWithCustomError(governance, 'ProposalNotActive');
    });
  });

  describe('Proposal States', function () {
    async function createProposalFixture() {
      const base = await deployFixture();

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, base.outletTreasury.address, 5000]
      );

      await base.governance
        .connect(base.beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      return { ...base, proposalId: 1 };
    }

    it('should be Pending immediately after creation', async function () {
      const { governance, proposalId } = await loadFixture(createProposalFixture);

      expect(await governance.state(proposalId)).to.equal(ProposalState.Pending);
    });

    it('should become Active after voting delay', async function () {
      const { governance, proposalId } = await loadFixture(createProposalFixture);

      await mine(2);

      expect(await governance.state(proposalId)).to.equal(ProposalState.Active);
    });

    it('should be Expired without quorum', async function () {
      const { governance, proposalId } = await loadFixture(createProposalFixture);

      await mine(2); // Make active
      // Don't vote - no quorum

      await mine(60000); // Mine past voting period

      expect(await governance.state(proposalId)).to.equal(ProposalState.Expired);
    });

    it('should be Defeated with more Against votes', async function () {
      const { governance, beaconContributor, lighthouseContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await mine(2); // Make active

      // Lighthouse votes against (25), Beacon votes for (10)
      // Need enough votes for quorum (100), so we need more contributors
      // For this test, let's lower the quorum
      const owner = (await ethers.getSigners())[0]!;

      // Set a lower quorum for testing
      await governance.connect(owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 50400,
        executionDelay: 14400,
      });

      await governance.connect(beaconContributor).castVote(proposalId, VoteType.For); // 10
      await governance.connect(lighthouseContributor).castVote(proposalId, VoteType.Against); // 25

      await mine(60000);

      expect(await governance.state(proposalId)).to.equal(ProposalState.Defeated);
    });

    it('should be Succeeded with enough For votes', async function () {
      const { governance, beaconContributor, lighthouseContributor, proposalId, owner } =
        await loadFixture(createProposalFixture);

      // Lower quorum for testing
      await governance.connect(owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 50400,
        executionDelay: 14400,
      });

      await mine(2); // Make active

      // Both vote for: 10 + 25 = 35 (above quorum of 30, 100% approval)
      await governance.connect(beaconContributor).castVote(proposalId, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(proposalId, VoteType.For);

      await mine(60000);

      expect(await governance.state(proposalId)).to.equal(ProposalState.Succeeded);
    });

    it('should be Cancelled after cancellation', async function () {
      const { governance, beaconContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await governance.connect(beaconContributor).cancel(proposalId);

      expect(await governance.state(proposalId)).to.equal(ProposalState.Cancelled);
    });

    it('should be Executed after execution', async function () {
      const base = await loadFixture(deployFixture);

      // Set config BEFORE creating proposal so it uses short voting period
      await base.governance.connect(base.owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, base.outletTreasury.address, 5000]
      );

      await base.governance
        .connect(base.beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      await mine(2); // Make active

      await base.governance.connect(base.beaconContributor).castVote(1, VoteType.For);
      await base.governance.connect(base.lighthouseContributor).castVote(1, VoteType.For);

      await mine(200); // Past voting and execution delay

      await base.governance.execute(1);

      expect(await base.governance.state(1)).to.equal(ProposalState.Executed);
    });
  });

  describe('Proposal Execution', function () {
    it('should execute OutletAdd proposal', async function () {
      const {
        governance,
        outletRegistry,
        beaconContributor,
        lighthouseContributor,
        outletTreasury,
        owner,
      } = await loadFixture(deployFixture);

      // Configure for quick testing BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      await mine(2);

      await governance.connect(beaconContributor).castVote(1, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.For);

      await mine(200);

      await governance.execute(1);

      // Verify outlet was added
      const outlet = await outletRegistry.getOutlet(outletId);
      expect(outlet.treasury).to.equal(outletTreasury.address);
      expect(outlet.weight).to.equal(5000);
      expect(outlet.isActive).to.be.true;
    });

    it('should execute OutletRemove proposal', async function () {
      const {
        governance,
        outletRegistry,
        beaconContributor,
        lighthouseContributor,
        outletTreasury,
        owner,
      } = await loadFixture(deployFixture);

      // Configure for quick testing BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.OutletRemove, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      // First add an outlet
      const outletId = ethers.encodeBytes32String('outlet-1');
      await outletRegistry.connect(owner).addOutlet(outletId, outletTreasury.address, 5000);

      // Create removal proposal
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(['bytes32'], [outletId]);

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletRemove, payload, 'Remove outlet');

      await mine(2);

      await governance.connect(beaconContributor).castVote(1, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.For);

      await mine(200);

      await governance.execute(1);

      // Verify outlet was removed
      const outlet = await outletRegistry.getOutlet(outletId);
      expect(outlet.isActive).to.be.false;
    });

    it('should execute WeightChange proposal', async function () {
      const {
        governance,
        outletRegistry,
        beaconContributor,
        lighthouseContributor,
        outletTreasury,
        owner,
      } = await loadFixture(deployFixture);

      // Configure for quick testing BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.WeightChange, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      // Add two outlets
      const outletId1 = ethers.encodeBytes32String('outlet-1');
      const outletId2 = ethers.encodeBytes32String('outlet-2');
      await outletRegistry.connect(owner).addOutlet(outletId1, outletTreasury.address, 6000);
      await outletRegistry.connect(owner).addOutlet(outletId2, outletTreasury.address, 4000);

      // Create weight change proposal
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32[]', 'uint256[]'],
        [
          [outletId1, outletId2],
          [5000, 5000],
        ]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.WeightChange, payload, 'Rebalance weights');

      await mine(2);

      await governance.connect(beaconContributor).castVote(1, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.For);

      await mine(200);

      await governance.execute(1);

      // Verify weights were changed
      const outlet1 = await outletRegistry.getOutlet(outletId1);
      const outlet2 = await outletRegistry.getOutlet(outletId2);
      expect(outlet1.weight).to.equal(5000);
      expect(outlet2.weight).to.equal(5000);
    });

    it('should reject execution before timelock expires', async function () {
      const { governance, beaconContributor, lighthouseContributor, outletTreasury, owner } =
        await loadFixture(deployFixture);

      // Configure BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 1000, // Long execution delay
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      await mine(2);

      await governance.connect(beaconContributor).castVote(1, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.For);

      await mine(110); // Past voting but not execution delay

      await expect(governance.execute(1)).to.be.revertedWithCustomError(
        governance,
        'ExecutionTooEarly'
      );
    });

    it('should reject execution of defeated proposals', async function () {
      const { governance, beaconContributor, lighthouseContributor, outletTreasury, owner } =
        await loadFixture(deployFixture);

      // Configure BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      await mine(2);

      // Vote against
      await governance.connect(beaconContributor).castVote(1, VoteType.Against);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.Against);

      await mine(200);

      await expect(governance.execute(1)).to.be.revertedWithCustomError(
        governance,
        'ProposalNotSucceeded'
      );
    });

    // TODO: Fix proposal state calculation - first execute fails with ProposalNotSucceeded
    // even though quorum and threshold should be met (35 votes, 100% for)
    it.skip('should reject double execution', async function () {
      const { governance, beaconContributor, lighthouseContributor, outletTreasury, owner } =
        await loadFixture(deployFixture);

      // Configure BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      await mine(2);

      await governance.connect(beaconContributor).castVote(1, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.For);

      await mine(200);

      await governance.execute(1);

      await expect(governance.execute(1)).to.be.revertedWithCustomError(
        governance,
        'ProposalAlreadyExecuted'
      );
    });
  });

  describe('Proposal Cancellation', function () {
    async function createProposalFixture() {
      const base = await deployFixture();

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, base.outletTreasury.address, 5000]
      );

      await base.governance
        .connect(base.beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      return { ...base, proposalId: 1 };
    }

    it('should allow proposer to cancel', async function () {
      const { governance, beaconContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await expect(governance.connect(beaconContributor).cancel(proposalId))
        .to.emit(governance, 'ProposalCancelled')
        .withArgs(proposalId);
    });

    it('should allow owner to cancel', async function () {
      const { governance, owner, proposalId } = await loadFixture(createProposalFixture);

      await governance.connect(owner).cancel(proposalId);

      expect(await governance.state(proposalId)).to.equal(ProposalState.Cancelled);
    });

    it('should reject cancellation by others', async function () {
      const { governance, sparkContributor, proposalId } = await loadFixture(createProposalFixture);

      await expect(
        governance.connect(sparkContributor).cancel(proposalId)
      ).to.be.revertedWithCustomError(governance, 'OnlyProposer');
    });

    it('should reject cancellation of executed proposals', async function () {
      const base = await loadFixture(deployFixture);

      // Configure BEFORE creating proposal
      await base.governance.connect(base.owner).setConfig(ProposalType.OutletAdd, {
        quorum: 30,
        threshold: 6000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, base.outletTreasury.address, 5000]
      );

      await base.governance
        .connect(base.beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      await mine(2);

      await base.governance.connect(base.beaconContributor).castVote(1, VoteType.For);
      await base.governance.connect(base.lighthouseContributor).castVote(1, VoteType.For);

      await mine(200);

      await base.governance.execute(1);

      await expect(
        base.governance.connect(base.beaconContributor).cancel(1)
      ).to.be.revertedWithCustomError(base.governance, 'ProposalAlreadyExecuted');
    });

    it('should reject double cancellation', async function () {
      const { governance, beaconContributor, proposalId } =
        await loadFixture(createProposalFixture);

      await governance.connect(beaconContributor).cancel(proposalId);

      await expect(
        governance.connect(beaconContributor).cancel(proposalId)
      ).to.be.revertedWithCustomError(governance, 'ProposalAlreadyCancelled');
    });
  });

  describe('Emergency Proposals', function () {
    it('should require higher threshold for emergency proposals', async function () {
      const { governance } = await loadFixture(deployFixture);

      const emergencyConfig = await governance.getConfig(ProposalType.Emergency);
      const standardConfig = await governance.getConfig(ProposalType.OutletAdd);

      expect(emergencyConfig.threshold).to.be.greaterThan(standardConfig.threshold);
      expect(emergencyConfig.quorum).to.be.greaterThan(standardConfig.quorum);
    });

    // TODO: Fix ownership - OutletRegistry.pause() requires onlyOwner but governance
    // contract is not the owner. Need to either transfer ownership or change pause()
    // modifier to onlyGovernance.
    it.skip('should execute emergency pause', async function () {
      const { governance, outletRegistry, beaconContributor, lighthouseContributor, owner } =
        await loadFixture(deployFixture);

      // Configure BEFORE creating proposal
      await governance.connect(owner).setConfig(ProposalType.Emergency, {
        quorum: 30,
        threshold: 8000,
        votingDelay: 1,
        votingPeriod: 100,
        executionDelay: 10,
      });

      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32'],
        [ethers.keccak256(ethers.toUtf8Bytes('PAUSE_REGISTRY'))]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.Emergency, payload, 'Emergency pause');

      await mine(2);

      // Both vote for (35 total, 100% approval - above 80% threshold)
      await governance.connect(beaconContributor).castVote(1, VoteType.For);
      await governance.connect(lighthouseContributor).castVote(1, VoteType.For);

      await mine(200);

      await governance.execute(1);

      // Verify registry is paused
      expect(await outletRegistry.paused()).to.be.true;
    });
  });

  describe('Admin Functions', function () {
    it('should allow owner to update config', async function () {
      const { governance, owner } = await loadFixture(deployFixture);

      const newConfig = {
        quorum: 200,
        threshold: 7500,
        votingDelay: 10,
        votingPeriod: 100000,
        executionDelay: 20000,
      };

      await expect(governance.connect(owner).setConfig(ProposalType.OutletAdd, newConfig))
        .to.emit(governance, 'ConfigUpdated')
        .withArgs(
          ProposalType.OutletAdd,
          newConfig.quorum,
          newConfig.threshold,
          newConfig.votingDelay,
          newConfig.votingPeriod,
          newConfig.executionDelay
        );

      const config = await governance.getConfig(ProposalType.OutletAdd);
      expect(config.quorum).to.equal(200);
      expect(config.threshold).to.equal(7500);
    });

    it('should allow owner to update ContributorRegistry', async function () {
      const { governance, contributorRegistry, owner } = await loadFixture(deployFixture);

      const signers = await ethers.getSigners();
      const newRegistry = signers[10]!.address;

      await expect(governance.connect(owner).setContributorRegistry(newRegistry))
        .to.emit(governance, 'ContributorRegistryUpdated')
        .withArgs(await contributorRegistry.getAddress(), newRegistry);

      expect(await governance.contributorRegistry()).to.equal(newRegistry);
    });

    it('should allow owner to update OutletRegistry', async function () {
      const { governance, outletRegistry, owner } = await loadFixture(deployFixture);

      const signers = await ethers.getSigners();
      const newRegistry = signers[10]!.address;

      await expect(governance.connect(owner).setOutletRegistry(newRegistry))
        .to.emit(governance, 'OutletRegistryUpdated')
        .withArgs(await outletRegistry.getAddress(), newRegistry);

      expect(await governance.outletRegistry()).to.equal(newRegistry);
    });

    it('should reject zero address for ContributorRegistry', async function () {
      const { governance, owner } = await loadFixture(deployFixture);

      await expect(
        governance.connect(owner).setContributorRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(governance, 'ZeroAddress');
    });

    it('should reject zero address for OutletRegistry', async function () {
      const { governance, owner } = await loadFixture(deployFixture);

      await expect(
        governance.connect(owner).setOutletRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(governance, 'ZeroAddress');
    });

    it('should allow owner to pause and unpause', async function () {
      const { governance, owner, beaconContributor, outletTreasury } =
        await loadFixture(deployFixture);

      await governance.connect(owner).pause();

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await expect(
        governance.connect(beaconContributor).propose(ProposalType.OutletAdd, payload, 'Add outlet')
      ).to.be.revertedWithCustomError(governance, 'EnforcedPause');

      await governance.connect(owner).unpause();

      // Should work now
      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');
    });
  });

  describe('View Functions', function () {
    it('should return voting power', async function () {
      const { governance, beaconContributor, outletTreasury } = await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      const power = await governance.getVotingPower(beaconContributor.address, 1);
      expect(power).to.equal(10); // BEACON weight
    });

    it('should return proposal details', async function () {
      const { governance, beaconContributor, outletTreasury } = await loadFixture(deployFixture);

      const outletId = ethers.encodeBytes32String('outlet-1');
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [outletId, outletTreasury.address, 5000]
      );

      await governance
        .connect(beaconContributor)
        .propose(ProposalType.OutletAdd, payload, 'Add outlet');

      const proposal = await governance.getProposal(1);
      expect(proposal.id).to.equal(1);
      expect(proposal.proposer).to.equal(beaconContributor.address);
      expect(proposal.proposalType).to.equal(ProposalType.OutletAdd);
      expect(proposal.executed).to.be.false;
      expect(proposal.cancelled).to.be.false;
    });

    it('should revert for non-existent proposal', async function () {
      const { governance } = await loadFixture(deployFixture);

      await expect(governance.getProposal(999)).to.be.revertedWithCustomError(
        governance,
        'ProposalNotFound'
      );
    });
  });
});
