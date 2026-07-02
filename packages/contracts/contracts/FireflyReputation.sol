// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title FireflyReputation
 * @notice Simple on-chain reputation storage for Firefly Network.
 * @dev Stores topic-weighted reputation scores for DIM credential hashes.
 *      Scores are integers from 0-1000 (500 = neutral starting point).
 *
 * Design decisions:
 *   - Topics are stored as bytes32 (keccak256 of topic string)
 *   - Scores are uint16 (0-1000 range fits in 16 bits)
 *   - Only authorized updaters can modify scores
 *   - Credential hashes are bytes32 (DIM credential hash)
 *
 * This is intentionally simple — no complex decay algorithms or
 * weighted averages on-chain. Those can be computed off-chain from
 * the raw scores stored here.
 */
contract FireflyReputation is Ownable2StepUpgradeable, UUPSUpgradeable {
    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Default starting score (neutral)
    uint16 public constant DEFAULT_SCORE = 500;

    /// @notice Minimum score
    uint16 public constant MIN_SCORE = 0;

    /// @notice Maximum score
    uint16 public constant MAX_SCORE = 1000;

    // =========================================================================
    // Types
    // =========================================================================

    struct TopicScore {
        uint16 score;
        uint32 corroborationsGiven;
        uint32 corroborationsReceived;
        uint32 challengesWon;
        uint32 challengesLost;
        uint64 lastUpdated;
    }

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Reputation scores: credential => topic => score
    mapping(bytes32 => mapping(bytes32 => TopicScore)) public scores;

    /// @notice Addresses authorized to update scores
    mapping(address => bool) public updaters;

    /// @notice Registered topics (for enumeration)
    bytes32[] public topics;
    mapping(bytes32 => bool) public isRegisteredTopic;

    // =========================================================================
    // Events
    // =========================================================================

    event ScoreUpdated(
        bytes32 indexed credential,
        bytes32 indexed topic,
        uint16 oldScore,
        uint16 newScore,
        string reason
    );

    event CorroborationRecorded(
        bytes32 indexed corroboratorCredential,
        bytes32 indexed authorCredential,
        bytes32 indexed topic,
        bytes32 signalId
    );

    event ChallengeRecorded(
        bytes32 indexed challengedCredential,
        bytes32 indexed topic,
        bytes32 signalId
    );

    event UpdaterAdded(address indexed updater);
    event UpdaterRemoved(address indexed updater);
    event TopicRegistered(bytes32 indexed topic, string name);

    // =========================================================================
    // Errors
    // =========================================================================

    error NotAuthorized(address caller);
    error InvalidScore(uint16 score);
    error TopicNotRegistered(bytes32 topic);
    error TopicAlreadyRegistered(bytes32 topic);

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyUpdater() {
        if (!updaters[msg.sender] && msg.sender != owner()) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) public initializer {
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();

        // Register default topics
        _registerTopic("economy");
        _registerTopic("health");
        _registerTopic("politics");
        _registerTopic("infrastructure");
        _registerTopic("human-rights");
        _registerTopic("environment");
        _registerTopic("security");
        _registerTopic("education");
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Record a corroboration event.
     * @param corroboratorCredential_ The DIM credential of the corroborator
     * @param authorCredential_ The DIM credential of the signal author
     * @param topic_ The topic hash
     * @param signalId_ The signal being corroborated
     * @param corroboratorDelta_ Score change for corroborator (positive)
     * @param authorDelta_ Score change for author (positive)
     */
    function recordCorroboration(
        bytes32 corroboratorCredential_,
        bytes32 authorCredential_,
        bytes32 topic_,
        bytes32 signalId_,
        int16 corroboratorDelta_,
        int16 authorDelta_
    ) external onlyUpdater {
        if (!isRegisteredTopic[topic_]) {
            revert TopicNotRegistered(topic_);
        }

        // Update corroborator
        TopicScore storage corroboratorScore = scores[corroboratorCredential_][topic_];
        _initializeIfNeeded(corroboratorScore);
        uint16 oldCorroboratorScore = corroboratorScore.score;
        corroboratorScore.score = _applyDelta(corroboratorScore.score, corroboratorDelta_);
        corroboratorScore.corroborationsGiven += 1;
        corroboratorScore.lastUpdated = uint64(block.timestamp);

        emit ScoreUpdated(
            corroboratorCredential_,
            topic_,
            oldCorroboratorScore,
            corroboratorScore.score,
            "corroboration_given"
        );

        // Update author
        TopicScore storage authorScore = scores[authorCredential_][topic_];
        _initializeIfNeeded(authorScore);
        uint16 oldAuthorScore = authorScore.score;
        authorScore.score = _applyDelta(authorScore.score, authorDelta_);
        authorScore.corroborationsReceived += 1;
        authorScore.lastUpdated = uint64(block.timestamp);

        emit ScoreUpdated(
            authorCredential_,
            topic_,
            oldAuthorScore,
            authorScore.score,
            "corroboration_received"
        );

        emit CorroborationRecorded(
            corroboratorCredential_,
            authorCredential_,
            topic_,
            signalId_
        );
    }

    /**
     * @notice Record a successful challenge (decreases challenged user's score).
     * @param challengedCredential_ The DIM credential of the challenged user
     * @param topic_ The topic hash
     * @param signalId_ The challenged signal
     * @param scoreDelta_ Score change (negative)
     */
    function recordChallenge(
        bytes32 challengedCredential_,
        bytes32 topic_,
        bytes32 signalId_,
        int16 scoreDelta_
    ) external onlyUpdater {
        if (!isRegisteredTopic[topic_]) {
            revert TopicNotRegistered(topic_);
        }

        TopicScore storage score = scores[challengedCredential_][topic_];
        _initializeIfNeeded(score);
        uint16 oldScore = score.score;
        score.score = _applyDelta(score.score, scoreDelta_);
        score.challengesLost += 1;
        score.lastUpdated = uint64(block.timestamp);

        emit ScoreUpdated(
            challengedCredential_,
            topic_,
            oldScore,
            score.score,
            "challenge_lost"
        );

        emit ChallengeRecorded(challengedCredential_, topic_, signalId_);
    }

    /**
     * @notice Directly set a score (for admin corrections).
     * @param credential_ The DIM credential
     * @param topic_ The topic hash
     * @param newScore_ The new score (0-1000)
     */
    function setScore(
        bytes32 credential_,
        bytes32 topic_,
        uint16 newScore_
    ) external onlyUpdater {
        if (!isRegisteredTopic[topic_]) {
            revert TopicNotRegistered(topic_);
        }
        if (newScore_ > MAX_SCORE) {
            revert InvalidScore(newScore_);
        }

        TopicScore storage score = scores[credential_][topic_];
        uint16 oldScore = score.score;
        score.score = newScore_;
        score.lastUpdated = uint64(block.timestamp);

        emit ScoreUpdated(credential_, topic_, oldScore, newScore_, "admin_set");
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get a credential's score for a topic.
     */
    function getScore(bytes32 credential_, bytes32 topic_) external view returns (uint16) {
        TopicScore storage score = scores[credential_][topic_];
        if (score.lastUpdated == 0) {
            return DEFAULT_SCORE;
        }
        return score.score;
    }

    /**
     * @notice Get full topic score details.
     */
    function getTopicScore(
        bytes32 credential_,
        bytes32 topic_
    ) external view returns (TopicScore memory) {
        TopicScore storage score = scores[credential_][topic_];
        if (score.lastUpdated == 0) {
            return TopicScore({
                score: DEFAULT_SCORE,
                corroborationsGiven: 0,
                corroborationsReceived: 0,
                challengesWon: 0,
                challengesLost: 0,
                lastUpdated: 0
            });
        }
        return score;
    }

    /**
     * @notice Get scores for multiple topics.
     */
    function getScores(
        bytes32 credential_,
        bytes32[] calldata topics_
    ) external view returns (uint16[] memory) {
        uint16[] memory result = new uint16[](topics_.length);
        for (uint256 i = 0; i < topics_.length; i++) {
            TopicScore storage score = scores[credential_][topics_[i]];
            result[i] = score.lastUpdated == 0 ? DEFAULT_SCORE : score.score;
        }
        return result;
    }

    /**
     * @notice Get all registered topics.
     */
    function getTopics() external view returns (bytes32[] memory) {
        return topics;
    }

    /**
     * @notice Get topic count.
     */
    function topicCount() external view returns (uint256) {
        return topics.length;
    }

    /**
     * @notice Convert topic string to hash.
     */
    function topicHash(string calldata topic_) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(topic_));
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    function addUpdater(address updater_) external onlyOwner {
        updaters[updater_] = true;
        emit UpdaterAdded(updater_);
    }

    function removeUpdater(address updater_) external onlyOwner {
        updaters[updater_] = false;
        emit UpdaterRemoved(updater_);
    }

    function registerTopic(string calldata name_) external onlyOwner {
        _registerTopic(name_);
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _registerTopic(string memory name_) private {
        bytes32 hash = keccak256(abi.encodePacked(name_));
        if (isRegisteredTopic[hash]) {
            revert TopicAlreadyRegistered(hash);
        }
        topics.push(hash);
        isRegisteredTopic[hash] = true;
        emit TopicRegistered(hash, name_);
    }

    function _initializeIfNeeded(TopicScore storage score_) private {
        if (score_.lastUpdated == 0) {
            score_.score = DEFAULT_SCORE;
        }
    }

    function _applyDelta(uint16 current_, int16 delta_) private pure returns (uint16) {
        int32 result = int32(uint32(current_)) + int32(delta_);
        if (result < int32(uint32(MIN_SCORE))) {
            return MIN_SCORE;
        }
        if (result > int32(uint32(MAX_SCORE))) {
            return MAX_SCORE;
        }
        return uint16(uint32(result));
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
