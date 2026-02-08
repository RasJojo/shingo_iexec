// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

contract ShingoHub is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        OPEN,
        CLOSED
    }

    struct Trader {
        string pseudo;
        address wallet;
        uint256 currentSeasonId;
        bool active;
        uint256 registeredAt;
    }

    struct Season {
        uint256 id;
        address trader;
        uint256 priceToken;
        string collectionId;
        Status status;
        uint256 openedAt;
        uint256 closedAt;
        uint256 signalCount;
    }

    struct Signal {
        uint256 id;
        uint256 seasonId;
        address trader;
        string protectedDataAddr;
        uint256 publishedAt;
    }

    struct Subscription {
        address subscriber;
        uint256 seasonId;
        uint256 paidAt;
        uint256 amountToken;
    }

    error ZeroAddress();
    error InvalidAmount();
    error InvalidPseudo();
    error InvalidPseudoCharacter();
    error EmptyValue();
    error Unauthorized();
    error TraderAlreadyRegistered();
    error TraderNotRegistered();
    error PseudoTaken();
    error SeasonNotFound();
    error SeasonAlreadyOpen();
    error SeasonNotOpen();
    error AlreadySubscribed();
    error SignalNotFound();

    event TraderRegistered(address indexed trader, string pseudo);
    event PseudoUpdated(address indexed trader, string newPseudo);
    event SeasonOpened(address indexed trader, uint256 indexed seasonId, uint256 priceToken);
    event SeasonClosed(address indexed trader, uint256 indexed seasonId);
    event SeasonCollectionLinked(uint256 indexed seasonId, string collectionId);
    event SignalPublished(
        address indexed trader,
        uint256 indexed seasonId,
        uint256 indexed signalId,
        string protectedDataAddr
    );
    event Subscribed(
        address indexed subscriber,
        address indexed trader,
        uint256 indexed seasonId,
        uint256 amountToken
    );
    event RelayUpdated(address indexed relay);

    IERC20 public immutable paymentToken;

    address public relay;

    uint256 private _nextSeasonId = 1;
    uint256 private _nextSignalId = 1;

    mapping(address => Trader) private _traders;
    mapping(bytes32 => address) private _pseudoOwners;

    mapping(uint256 => Season) private _seasons;
    mapping(uint256 => Signal) private _signals;

    mapping(address => uint256[]) private _traderSeasonIds;
    mapping(uint256 => uint256[]) private _seasonSignalIds;
    mapping(uint256 => address[]) private _seasonSubscribers;

    mapping(uint256 => mapping(address => Subscription)) private _subscriptions;

    constructor(address paymentToken_, address initialOwner) Ownable(initialOwner) {
        if (paymentToken_ == address(0)) {
            revert ZeroAddress();
        }
        paymentToken = IERC20(paymentToken_);
    }

    modifier onlyActiveTrader() {
        if (!_traders[msg.sender].active) {
            revert TraderNotRegistered();
        }
        _;
    }

    modifier onlyOwnerOrRelay() {
        if (msg.sender != owner() && msg.sender != relay) {
            revert Unauthorized();
        }
        _;
    }

    function setRelay(address relay_) external onlyOwner {
        relay = relay_;
        emit RelayUpdated(relay_);
    }

    function registerTrader(string calldata pseudo) external {
        if (_traders[msg.sender].active) {
            revert TraderAlreadyRegistered();
        }

        bytes32 pseudoKey = _pseudoKey(pseudo);
        if (_pseudoOwners[pseudoKey] != address(0)) {
            revert PseudoTaken();
        }

        _pseudoOwners[pseudoKey] = msg.sender;
        _traders[msg.sender] = Trader({
            pseudo: pseudo,
            wallet: msg.sender,
            currentSeasonId: 0,
            active: true,
            registeredAt: block.timestamp
        });

        emit TraderRegistered(msg.sender, pseudo);
    }

    function updatePseudo(string calldata newPseudo) external onlyActiveTrader {
        bytes32 nextPseudoKey = _pseudoKey(newPseudo);
        address nextOwner = _pseudoOwners[nextPseudoKey];

        if (nextOwner != address(0) && nextOwner != msg.sender) {
            revert PseudoTaken();
        }

        Trader storage trader = _traders[msg.sender];
        bytes32 previousPseudoKey = _pseudoKey(trader.pseudo);

        delete _pseudoOwners[previousPseudoKey];
        _pseudoOwners[nextPseudoKey] = msg.sender;

        trader.pseudo = newPseudo;

        emit PseudoUpdated(msg.sender, newPseudo);
    }

    function openSeason(uint256 priceToken) external onlyActiveTrader returns (uint256 seasonId) {
        if (priceToken == 0) {
            revert InvalidAmount();
        }

        Trader storage trader = _traders[msg.sender];
        uint256 currentSeasonId = trader.currentSeasonId;
        if (currentSeasonId != 0 && _seasons[currentSeasonId].status == Status.OPEN) {
            revert SeasonAlreadyOpen();
        }

        seasonId = _nextSeasonId;
        _nextSeasonId += 1;

        _seasons[seasonId] = Season({
            id: seasonId,
            trader: msg.sender,
            priceToken: priceToken,
            collectionId: '',
            status: Status.OPEN,
            openedAt: block.timestamp,
            closedAt: 0,
            signalCount: 0
        });

        trader.currentSeasonId = seasonId;
        _traderSeasonIds[msg.sender].push(seasonId);

        emit SeasonOpened(msg.sender, seasonId, priceToken);
    }

    function closeSeason() external onlyActiveTrader {
        Trader storage trader = _traders[msg.sender];
        uint256 seasonId = trader.currentSeasonId;
        if (seasonId == 0) {
            revert SeasonNotFound();
        }

        Season storage season = _seasons[seasonId];
        if (season.status != Status.OPEN) {
            revert SeasonNotOpen();
        }

        season.status = Status.CLOSED;
        season.closedAt = block.timestamp;
        trader.currentSeasonId = 0;

        emit SeasonClosed(msg.sender, seasonId);
    }

    function setSeasonCollectionId(
        uint256 seasonId,
        string calldata collectionId
    ) external onlyOwnerOrRelay {
        if (bytes(collectionId).length == 0) {
            revert EmptyValue();
        }

        Season storage season = _seasons[seasonId];
        if (season.id == 0) {
            revert SeasonNotFound();
        }

        season.collectionId = collectionId;

        emit SeasonCollectionLinked(seasonId, collectionId);
    }

    function publishSignal(string calldata protectedDataAddr) external onlyActiveTrader returns (uint256 signalId) {
        if (bytes(protectedDataAddr).length == 0) {
            revert EmptyValue();
        }

        uint256 seasonId = _traders[msg.sender].currentSeasonId;
        if (seasonId == 0) {
            revert SeasonNotFound();
        }

        Season storage season = _seasons[seasonId];
        if (season.status != Status.OPEN) {
            revert SeasonNotOpen();
        }

        signalId = _nextSignalId;
        _nextSignalId += 1;

        _signals[signalId] = Signal({
            id: signalId,
            seasonId: seasonId,
            trader: msg.sender,
            protectedDataAddr: protectedDataAddr,
            publishedAt: block.timestamp
        });

        season.signalCount += 1;
        _seasonSignalIds[seasonId].push(signalId);

        emit SignalPublished(msg.sender, seasonId, signalId, protectedDataAddr);
    }

    function subscribe(uint256 seasonId) external nonReentrant {
        Season memory season = _seasons[seasonId];
        if (season.id == 0) {
            revert SeasonNotFound();
        }
        if (season.status != Status.OPEN) {
            revert SeasonNotOpen();
        }

        Trader memory trader = _traders[season.trader];
        if (trader.currentSeasonId != seasonId) {
            revert SeasonNotOpen();
        }

        Subscription storage existing = _subscriptions[seasonId][msg.sender];
        if (existing.paidAt != 0) {
            revert AlreadySubscribed();
        }

        paymentToken.safeTransferFrom(msg.sender, season.trader, season.priceToken);

        _subscriptions[seasonId][msg.sender] = Subscription({
            subscriber: msg.sender,
            seasonId: seasonId,
            paidAt: block.timestamp,
            amountToken: season.priceToken
        });
        _seasonSubscribers[seasonId].push(msg.sender);

        emit Subscribed(msg.sender, season.trader, seasonId, season.priceToken);
    }

    function isSubscribed(address subscriber, uint256 seasonId) external view returns (bool) {
        return _subscriptions[seasonId][subscriber].paidAt != 0;
    }

    function isSignalPublic(uint256 signalId) external view returns (bool) {
        Signal memory signal = _signals[signalId];
        if (signal.id == 0) {
            revert SignalNotFound();
        }
        return _seasons[signal.seasonId].status == Status.CLOSED;
    }

    function getTrader(address traderAddr) external view returns (Trader memory) {
        Trader memory trader = _traders[traderAddr];
        if (!trader.active) {
            revert TraderNotRegistered();
        }
        return trader;
    }

    function getTraderByPseudo(string calldata pseudo) external view returns (Trader memory) {
        address traderAddr = _pseudoOwners[_pseudoKey(pseudo)];
        if (traderAddr == address(0)) {
            revert TraderNotRegistered();
        }
        return _traders[traderAddr];
    }

    function getSeason(uint256 seasonId) external view returns (Season memory) {
        Season memory season = _seasons[seasonId];
        if (season.id == 0) {
            revert SeasonNotFound();
        }
        return season;
    }

    function getSignal(uint256 signalId) external view returns (Signal memory) {
        Signal memory signal = _signals[signalId];
        if (signal.id == 0) {
            revert SignalNotFound();
        }
        return signal;
    }

    function getSeasonSignalIds(uint256 seasonId) external view returns (uint256[] memory) {
        if (_seasons[seasonId].id == 0) {
            revert SeasonNotFound();
        }
        return _seasonSignalIds[seasonId];
    }

    function getSeasonSubscribers(uint256 seasonId) external view returns (address[] memory) {
        if (_seasons[seasonId].id == 0) {
            revert SeasonNotFound();
        }
        return _seasonSubscribers[seasonId];
    }

    function getTraderSeasonIds(address traderAddr) external view returns (uint256[] memory) {
        if (!_traders[traderAddr].active) {
            revert TraderNotRegistered();
        }
        return _traderSeasonIds[traderAddr];
    }

    function getSubscription(
        address subscriber,
        uint256 seasonId
    ) external view returns (Subscription memory) {
        if (_seasons[seasonId].id == 0) {
            revert SeasonNotFound();
        }
        return _subscriptions[seasonId][subscriber];
    }

    function getSeasonSignals(
        uint256 seasonId,
        uint256 offset,
        uint256 limit
    ) external view returns (Signal[] memory) {
        if (_seasons[seasonId].id == 0) {
            revert SeasonNotFound();
        }
        if (limit == 0) {
            return new Signal[](0);
        }

        uint256[] memory ids = _seasonSignalIds[seasonId];
        if (offset >= ids.length) {
            return new Signal[](0);
        }

        uint256 end = offset + limit;
        if (end > ids.length) {
            end = ids.length;
        }

        uint256 outLength = end - offset;
        Signal[] memory out = new Signal[](outLength);

        for (uint256 i = 0; i < outLength; i++) {
            out[i] = _signals[ids[offset + i]];
        }

        return out;
    }

    function nextSeasonId() external view returns (uint256) {
        return _nextSeasonId;
    }

    function nextSignalId() external view returns (uint256) {
        return _nextSignalId;
    }

    function _pseudoKey(string memory pseudo) internal pure returns (bytes32) {
        bytes memory normalized = _normalizePseudo(pseudo);
        return keccak256(normalized);
    }

    function _normalizePseudo(string memory pseudo) internal pure returns (bytes memory normalized) {
        bytes memory source = bytes(pseudo);
        uint256 len = source.length;
        if (len < 3 || len > 24) {
            revert InvalidPseudo();
        }

        normalized = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            bytes1 ch = source[i];

            // A-Z -> a-z
            if (ch >= 0x41 && ch <= 0x5A) {
                ch = bytes1(uint8(ch) + 32);
            }

            bool isLower = (ch >= 0x61 && ch <= 0x7A);
            bool isDigit = (ch >= 0x30 && ch <= 0x39);
            bool isSpecial = (ch == 0x2d || ch == 0x5f || ch == 0x2e); // -, _, .

            if (!isLower && !isDigit && !isSpecial) {
                revert InvalidPseudoCharacter();
            }

            normalized[i] = ch;
        }
    }
}
