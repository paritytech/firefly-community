import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { FireflyReputation } from '../typechain-types';

describe('FireflyReputation', function () {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0]!;
    const updater = signers[1]!;
    const other = signers[2]!;

    const FireflyReputation = await ethers.getContractFactory('FireflyReputation');
    const reputation = (await upgrades.deployProxy(FireflyReputation, [owner.address], {
      initializer: 'initialize',
    })) as unknown as FireflyReputation;

    // Add updater
    await reputation.connect(owner).addUpdater(updater.address);

    // Create test credentials and topics
    const credential1 = ethers.keccak256(ethers.toUtf8Bytes('dim-anon-001'));
    const credential2 = ethers.keccak256(ethers.toUtf8Bytes('dim-anon-002'));
    const signalId = ethers.keccak256(ethers.toUtf8Bytes('sig-001'));

    // Get topic hashes
    const economyTopic = await reputation.topicHash('economy');
    const healthTopic = await reputation.topicHash('health');

    return {
      reputation,
      owner,
      updater,
      other,
      credential1,
      credential2,
      signalId,
      economyTopic,
      healthTopic,
    };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { reputation, owner } = await loadFixture(deployFixture);
      expect(await reputation.owner()).to.equal(owner.address);
    });

    it('should register default topics', async function () {
      const { reputation } = await loadFixture(deployFixture);
      expect(await reputation.topicCount()).to.equal(8);

      const topics = await reputation.getTopics();
      expect(topics.length).to.equal(8);
    });

    it('should set DEFAULT_SCORE to 500', async function () {
      const { reputation } = await loadFixture(deployFixture);
      expect(await reputation.DEFAULT_SCORE()).to.equal(500);
    });
  });

  describe('getScore', function () {
    it('should return DEFAULT_SCORE for unknown credentials', async function () {
      const { reputation, credential1, economyTopic } = await loadFixture(deployFixture);
      expect(await reputation.getScore(credential1, economyTopic)).to.equal(500);
    });
  });

  describe('recordCorroboration', function () {
    it('should increase both corroborator and author scores', async function () {
      const { reputation, updater, credential1, credential2, signalId, economyTopic } =
        await loadFixture(deployFixture);

      const corroboratorDelta = 5;
      const authorDelta = 10;

      await reputation
        .connect(updater)
        .recordCorroboration(
          credential1,
          credential2,
          economyTopic,
          signalId,
          corroboratorDelta,
          authorDelta
        );

      expect(await reputation.getScore(credential1, economyTopic)).to.equal(
        500 + corroboratorDelta
      );
      expect(await reputation.getScore(credential2, economyTopic)).to.equal(500 + authorDelta);
    });

    it('should increment corroboration counts', async function () {
      const { reputation, updater, credential1, credential2, signalId, economyTopic } =
        await loadFixture(deployFixture);

      await reputation
        .connect(updater)
        .recordCorroboration(credential1, credential2, economyTopic, signalId, 5, 10);

      const corroboratorScore = await reputation.getTopicScore(credential1, economyTopic);
      const authorScore = await reputation.getTopicScore(credential2, economyTopic);

      expect(corroboratorScore.corroborationsGiven).to.equal(1);
      expect(authorScore.corroborationsReceived).to.equal(1);
    });

    it('should emit ScoreUpdated events', async function () {
      const { reputation, updater, credential1, credential2, signalId, economyTopic } =
        await loadFixture(deployFixture);

      await expect(
        reputation
          .connect(updater)
          .recordCorroboration(credential1, credential2, economyTopic, signalId, 5, 10)
      )
        .to.emit(reputation, 'ScoreUpdated')
        .withArgs(credential1, economyTopic, 500, 505, 'corroboration_given')
        .and.to.emit(reputation, 'ScoreUpdated')
        .withArgs(credential2, economyTopic, 500, 510, 'corroboration_received');
    });

    it('should revert if topic not registered', async function () {
      const { reputation, updater, credential1, credential2, signalId } =
        await loadFixture(deployFixture);

      const fakeTopic = ethers.keccak256(ethers.toUtf8Bytes('fake-topic'));

      await expect(
        reputation
          .connect(updater)
          .recordCorroboration(credential1, credential2, fakeTopic, signalId, 5, 10)
      ).to.be.revertedWithCustomError(reputation, 'TopicNotRegistered');
    });

    it('should revert if not updater', async function () {
      const { reputation, other, credential1, credential2, signalId, economyTopic } =
        await loadFixture(deployFixture);

      await expect(
        reputation
          .connect(other)
          .recordCorroboration(credential1, credential2, economyTopic, signalId, 5, 10)
      ).to.be.revertedWithCustomError(reputation, 'NotAuthorized');
    });
  });

  describe('recordChallenge', function () {
    it('should decrease challenged user score', async function () {
      const { reputation, updater, credential1, signalId, economyTopic } =
        await loadFixture(deployFixture);

      const scoreDelta = -50;

      await reputation
        .connect(updater)
        .recordChallenge(credential1, economyTopic, signalId, scoreDelta);

      expect(await reputation.getScore(credential1, economyTopic)).to.equal(500 + scoreDelta);
    });

    it('should increment challengesLost count', async function () {
      const { reputation, updater, credential1, signalId, economyTopic } =
        await loadFixture(deployFixture);

      await reputation.connect(updater).recordChallenge(credential1, economyTopic, signalId, -50);

      const score = await reputation.getTopicScore(credential1, economyTopic);
      expect(score.challengesLost).to.equal(1);
    });

    it('should not go below MIN_SCORE', async function () {
      const { reputation, updater, credential1, signalId, economyTopic } =
        await loadFixture(deployFixture);

      // Apply massive negative delta
      await reputation.connect(updater).recordChallenge(credential1, economyTopic, signalId, -1000);

      expect(await reputation.getScore(credential1, economyTopic)).to.equal(0);
    });
  });

  describe('setScore', function () {
    it('should set score directly', async function () {
      const { reputation, updater, credential1, economyTopic } = await loadFixture(deployFixture);

      await reputation.connect(updater).setScore(credential1, economyTopic, 800);

      expect(await reputation.getScore(credential1, economyTopic)).to.equal(800);
    });

    it('should revert if score > MAX_SCORE', async function () {
      const { reputation, updater, credential1, economyTopic } = await loadFixture(deployFixture);

      await expect(
        reputation.connect(updater).setScore(credential1, economyTopic, 1001)
      ).to.be.revertedWithCustomError(reputation, 'InvalidScore');
    });
  });

  describe('getScores', function () {
    it('should return scores for multiple topics', async function () {
      const { reputation, updater, credential1, economyTopic, healthTopic } =
        await loadFixture(deployFixture);

      // Set different scores for different topics
      await reputation.connect(updater).setScore(credential1, economyTopic, 700);
      await reputation.connect(updater).setScore(credential1, healthTopic, 600);

      const scores = await reputation.getScores(credential1, [economyTopic, healthTopic]);

      expect(scores[0]).to.equal(700);
      expect(scores[1]).to.equal(600);
    });
  });

  describe('Admin Functions', function () {
    it('owner can add updaters', async function () {
      const { reputation, owner, other } = await loadFixture(deployFixture);

      await expect(reputation.connect(owner).addUpdater(other.address))
        .to.emit(reputation, 'UpdaterAdded')
        .withArgs(other.address);

      expect(await reputation.updaters(other.address)).to.be.true;
    });

    it('owner can remove updaters', async function () {
      const { reputation, owner, updater } = await loadFixture(deployFixture);

      await expect(reputation.connect(owner).removeUpdater(updater.address))
        .to.emit(reputation, 'UpdaterRemoved')
        .withArgs(updater.address);

      expect(await reputation.updaters(updater.address)).to.be.false;
    });

    it('owner can register new topics', async function () {
      const { reputation, owner } = await loadFixture(deployFixture);

      const newTopicHash = await reputation.topicHash('new-topic');

      await expect(reputation.connect(owner).registerTopic('new-topic'))
        .to.emit(reputation, 'TopicRegistered')
        .withArgs(newTopicHash, 'new-topic');

      expect(await reputation.isRegisteredTopic(newTopicHash)).to.be.true;
      expect(await reputation.topicCount()).to.equal(9);
    });

    it('should revert if topic already registered', async function () {
      const { reputation, owner } = await loadFixture(deployFixture);

      await expect(
        reputation.connect(owner).registerTopic('economy')
      ).to.be.revertedWithCustomError(reputation, 'TopicAlreadyRegistered');
    });

    it('non-owner cannot add updaters', async function () {
      const { reputation, other } = await loadFixture(deployFixture);

      await expect(
        reputation.connect(other).addUpdater(other.address)
      ).to.be.revertedWithCustomError(reputation, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Score Bounds', function () {
    it('should not exceed MAX_SCORE', async function () {
      const { reputation, updater, credential1, credential2, economyTopic } =
        await loadFixture(deployFixture);

      // Set score close to max
      await reputation.connect(updater).setScore(credential1, economyTopic, 990);

      // Try to add more than would fit
      const signalId = ethers.keccak256(ethers.toUtf8Bytes('sig-test'));
      await reputation
        .connect(updater)
        .recordCorroboration(credential2, credential1, economyTopic, signalId, 5, 100);

      // Should be clamped to MAX_SCORE
      expect(await reputation.getScore(credential1, economyTopic)).to.equal(1000);
    });
  });
});
