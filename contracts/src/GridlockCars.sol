// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "solady/tokens/ERC721.sol";
import {ERC2981} from "solady/tokens/ERC2981.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {HeatLib} from "./HeatLib.sol";
import {IGridlockRenderer} from "./IGridlockRenderer.sol";

/// @title Gridlock Cars
/// @notice Fictional comic wanted-poster cars sold on a 15-rank ladder, plus 12 hunt-only hidden cars.
/// @dev Immutable. No owner, no admin, no proxy, no pause, no burn, no setters.
///      Heat is display only and changes no price, rule or right.
///      All time logic uses block.timestamp only.
contract GridlockCars is ERC721, ERC2981, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Params {
        address treasury;
        address renderer;
        uint64 startTime;
        uint64 openTimeout;
        uint64 heatDecaySeconds;
        uint64 revealMinDelay;
        uint16[15] caps; // index i is rank i + 1
        uint256[15] prices; // index i is rank i + 1
        bytes32[12] huntCommitments; // keccak256(abi.encodePacked(secret)) per hidden car
    }

    /// @dev One storage slot (232 bits). rank 0 is a hidden car and serial is then its hunt index.
    struct Car {
        uint8 rank;
        uint16 serial;
        uint48 mintedAt;
        uint32 transferCount;
        uint16 heat;
        uint48 heatUpdatedAt;
        uint16 peakHeat;
        uint48 lastMovedAt;
    }

    struct RungInfo {
        uint8 rank;
        uint16 sold;
        uint16 cap;
        uint256 price;
        uint64 opensAtLatest; // computed open time given current sell-outs; the rung is open when now >= this
        uint64 openedAt; // opensAtLatest if already open, else 0
        bool isOpen;
        uint64 soldOutAt; // 0 if not sold out
    }

    struct CarData {
        uint8 rank;
        uint16 serial; // hunt index when hidden
        bool hidden;
        uint64 mintedAt;
        uint32 transferCount;
        uint16 heat;
        uint8 stars;
        uint16 peakHeat;
        uint8 peakStars;
        uint64 lastMovedAt;
        uint64 heatZeroAt; // 0 when heat is already 0
    }

    struct Commit {
        bytes32 commitment;
        uint64 committedAt;
    }

    /*//////////////////////////////////////////////////////////////
                         ERC-4906, EVENTS, ERRORS
    //////////////////////////////////////////////////////////////*/

    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    event RankSoldOut(uint256 indexed rank, uint256 soldOutAt);
    event ClaimCommitted(address indexed claimer, bytes32 commitment);
    event HiddenClaimed(uint256 indexed index, address indexed claimer, uint256 tokenId);
    event Withdrawn(address indexed treasury, uint256 amount);

    error BadRank();
    error BadQuantity();
    error NotOpen();
    error WrongPayment();
    error SoldOut();
    error NotEnoughLeft();
    error SerialMismatch(uint256 nextSerial);
    error WalletCapReached();
    error BadIndex();
    error NoCommit();
    error CommitMismatch();
    error RevealTooEarly();
    error BadSecret();
    error AlreadyClaimed();
    error EmptyCommitment();

    error InvalidTreasury();
    error InvalidRenderer();
    error InvalidTimes();
    error InvalidCaps();
    error InvalidPrices();
    error InvalidHuntCommitments();

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant RANK_COUNT = 15;
    uint256 public constant HUNT_COUNT = 12;
    uint256 public constant TX_CAP = 2;
    uint96 public constant ROYALTY_BPS = 500;
    uint256 public constant HEAT_PER_TRANSFER = HeatLib.PER_TRANSFER;
    uint256 public constant HEAT_MAX = HeatLib.MAX;

    uint256 private constant _MAX_DURATION = 3650 days;

    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    address public immutable TREASURY;
    address public immutable RENDERER;
    uint64 public immutable START_TIME;
    uint64 public immutable OPEN_TIMEOUT;
    uint64 public immutable HEAT_DECAY_SECONDS;
    uint64 public immutable REVEAL_MIN_DELAY;
    /// @dev 15 caps of 16 bits, rank r at bits [(r - 1) * 16, r * 16).
    uint256 private immutable _CAPS_PACKED;

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    uint256[15] private _prices; // index i is rank i + 1
    bytes32[12] private _huntHash;

    uint256 private _lastId;
    uint16[16] private _sold; // indexed by rank 1..15
    uint64[16] private _soldOutAt; // indexed by rank 1..15
    mapping(uint256 => Car) private _cars;
    mapping(address => mapping(uint256 => uint8)) private _walletMinted;

    address[12] private _huntClaimer;
    uint16[12] private _huntTokenId;
    mapping(address => Commit) private _commits;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(Params memory p) {
        if (p.treasury == address(0)) revert InvalidTreasury();
        if (p.renderer.code.length == 0) revert InvalidRenderer();
        if (
            p.openTimeout == 0 || p.openTimeout > _MAX_DURATION || p.heatDecaySeconds == 0
                || p.heatDecaySeconds > _MAX_DURATION || p.revealMinDelay == 0 || p.revealMinDelay > 30 days
                || uint256(p.startTime) + uint256(p.openTimeout) * RANK_COUNT > type(uint48).max
        ) revert InvalidTimes();

        uint256 packed;
        for (uint256 i; i < RANK_COUNT; ++i) {
            if (p.caps[i] == 0) revert InvalidCaps();
            packed |= uint256(p.caps[i]) << (i * 16);
        }
        // Prices must be non-zero and rise from rank 15 to rank 1: price(rank k) >= price(rank k + 1).
        for (uint256 i; i < RANK_COUNT; ++i) {
            if (p.prices[i] == 0) revert InvalidPrices();
            if (i + 1 < RANK_COUNT && p.prices[i] < p.prices[i + 1]) revert InvalidPrices();
            _prices[i] = p.prices[i];
        }
        for (uint256 i; i < HUNT_COUNT; ++i) {
            if (p.huntCommitments[i] == bytes32(0)) revert InvalidHuntCommitments();
            for (uint256 j; j < i; ++j) {
                if (p.huntCommitments[j] == p.huntCommitments[i]) revert InvalidHuntCommitments();
            }
            _huntHash[i] = p.huntCommitments[i];
        }

        TREASURY = p.treasury;
        RENDERER = p.renderer;
        START_TIME = p.startTime;
        OPEN_TIMEOUT = p.openTimeout;
        HEAT_DECAY_SECONDS = p.heatDecaySeconds;
        REVEAL_MIN_DELAY = p.revealMinDelay;
        _CAPS_PACKED = packed;

        _setDefaultRoyalty(p.treasury, ROYALTY_BPS);
    }

    /*//////////////////////////////////////////////////////////////
                               ERC-721 META
    //////////////////////////////////////////////////////////////*/

    function name() public pure override returns (string memory) {
        return "Gridlock Cars";
    }

    function symbol() public pure override returns (string memory) {
        return "GRID";
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        if (!_exists(id)) revert TokenDoesNotExist();
        return IGridlockRenderer(RENDERER).tokenURI(id, _renderInput(_cars[id]));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        // 0x49064906 is ERC-4906.
        return ERC721.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId)
            || interfaceId == 0x49064906;
    }

    /*//////////////////////////////////////////////////////////////
                                  MINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint `quantity` cars of `rank` to the caller. Payment must be exact.
    /// @param expectedSerial The serial the caller previewed for the first car. Reverts if it changed.
    function mint(uint256 rank, uint256 quantity, uint256 expectedSerial) external payable nonReentrant {
        if (rank == 0 || rank > RANK_COUNT) revert BadRank();
        if (quantity == 0 || quantity > TX_CAP) revert BadQuantity();
        if (block.timestamp < _openedAt(rank)) revert NotOpen();
        if (msg.value != _prices[rank - 1] * quantity) revert WrongPayment();

        uint256 first = uint256(_sold[rank]) + 1;
        uint256 cap = capOf(rank);
        if (first > cap) revert SoldOut();
        if (first + quantity - 1 > cap) revert NotEnoughLeft();
        if (first != expectedSerial) revert SerialMismatch(first);
        if (uint256(_walletMinted[msg.sender][rank]) + quantity > walletRankCap(rank)) revert WalletCapReached();

        uint256 last = first + quantity - 1;
        _sold[rank] = uint16(last);
        _walletMinted[msg.sender][rank] += uint8(quantity);
        if (last == cap) {
            _soldOutAt[rank] = uint64(block.timestamp);
            emit RankSoldOut(rank, block.timestamp);
        }

        uint256 id = _lastId;
        for (uint256 s = first; s <= last; ++s) {
            ++id;
            _cars[id] = Car({
                rank: uint8(rank),
                serial: uint16(s),
                mintedAt: uint48(block.timestamp),
                transferCount: 0,
                heat: 0,
                heatUpdatedAt: uint48(block.timestamp),
                peakHeat: 0,
                lastMovedAt: 0
            });
            _lastId = id;
            _safeMint(msg.sender, id);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                  HUNT
    //////////////////////////////////////////////////////////////*/

    /// @notice Step 1. Store a commitment c = keccak256(abi.encode(secret, claimer, salt)) for the caller.
    function commitClaim(bytes32 commitment) external {
        if (commitment == bytes32(0)) revert EmptyCommitment();
        _commits[msg.sender] = Commit({commitment: commitment, committedAt: uint64(block.timestamp)});
        emit ClaimCommitted(msg.sender, commitment);
    }

    /// @notice Step 2. Reveal after REVEAL_MIN_DELAY. Mints hidden car `index` to the caller.
    function revealClaim(uint256 index, bytes32 secret, bytes32 salt) external nonReentrant {
        if (index >= HUNT_COUNT) revert BadIndex();
        Commit memory c = _commits[msg.sender];
        if (c.commitment == bytes32(0)) revert NoCommit();
        if (keccak256(abi.encode(secret, msg.sender, salt)) != c.commitment) revert CommitMismatch();
        if (block.timestamp < uint256(c.committedAt) + REVEAL_MIN_DELAY) revert RevealTooEarly();
        if (keccak256(abi.encodePacked(secret)) != _huntHash[index]) revert BadSecret();
        if (_huntClaimer[index] != address(0)) revert AlreadyClaimed();

        delete _commits[msg.sender];
        uint256 id = ++_lastId;
        _huntClaimer[index] = msg.sender;
        _huntTokenId[index] = uint16(id);
        _cars[id] = Car({
            rank: 0,
            serial: uint16(index),
            mintedAt: uint48(block.timestamp),
            transferCount: 0,
            heat: 0,
            heatUpdatedAt: uint48(block.timestamp),
            peakHeat: 0,
            lastMovedAt: 0
        });
        emit HiddenClaimed(index, msg.sender, id);
        _safeMint(msg.sender, id);
    }

    /*//////////////////////////////////////////////////////////////
                               WITHDRAW
    //////////////////////////////////////////////////////////////*/

    /// @notice Anyone may call. Sends the whole balance to the immutable TREASURY. Reverts if the send fails.
    function withdraw() external {
        uint256 amount = address(this).balance;
        SafeTransferLib.safeTransferETH(TREASURY, amount);
        emit Withdrawn(TREASURY, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    function totalMinted() public view returns (uint256) {
        return _lastId;
    }

    function totalSupply() external view returns (uint256) {
        return _lastId;
    }

    function capOf(uint256 rank) public view returns (uint256) {
        if (rank == 0 || rank > RANK_COUNT) revert BadRank();
        return (_CAPS_PACKED >> ((rank - 1) * 16)) & 0xffff;
    }

    function priceOf(uint256 rank) external view returns (uint256) {
        if (rank == 0 || rank > RANK_COUNT) revert BadRank();
        return _prices[rank - 1];
    }

    function soldOf(uint256 rank) external view returns (uint256) {
        if (rank == 0 || rank > RANK_COUNT) revert BadRank();
        return _sold[rank];
    }

    /// @notice Per-wallet cap per rank: 2 for ranks 15 to 6, 1 for ranks 5 to 1.
    function walletRankCap(uint256 rank) public pure returns (uint256) {
        if (rank == 0 || rank > RANK_COUNT) revert BadRank();
        return rank >= 6 ? 2 : 1;
    }

    function walletMinted(address owner, uint256 rank) external view returns (uint256) {
        return _walletMinted[owner][rank];
    }

    function huntCommitments() external view returns (bytes32[12] memory) {
        return _huntHash;
    }

    function claimCommit(address claimer) external view returns (bytes32 commitment, uint64 committedAt, uint64 revealableAt) {
        Commit memory c = _commits[claimer];
        commitment = c.commitment;
        committedAt = c.committedAt;
        revealableAt = c.commitment == bytes32(0) ? 0 : uint64(uint256(c.committedAt) + REVEAL_MIN_DELAY);
    }

    /// @notice The ladder, one entry per rank. Entry i is rank i + 1.
    function ladderState() external view returns (RungInfo[15] memory info) {
        uint256 t = START_TIME;
        for (uint256 rank = RANK_COUNT; rank >= 1; --rank) {
            bool open = block.timestamp >= t;
            info[rank - 1] = RungInfo({
                rank: uint8(rank),
                sold: _sold[rank],
                cap: uint16(capOf(rank)),
                price: _prices[rank - 1],
                opensAtLatest: uint64(t),
                openedAt: open ? uint64(t) : 0,
                isOpen: open,
                soldOutAt: _soldOutAt[rank]
            });
            if (rank == 1) break;
            t = _nextOpen(t, _soldOutAt[rank]);
        }
    }

    function carData(uint256 id) public view returns (CarData memory d) {
        if (!_exists(id)) revert TokenDoesNotExist();
        Car memory c = _cars[id];
        uint256 heat = _currentHeat(c);
        d.rank = c.rank;
        d.serial = c.serial;
        d.hidden = c.rank == 0;
        d.mintedAt = c.mintedAt;
        d.transferCount = c.transferCount;
        d.heat = uint16(heat);
        d.stars = HeatLib.stars(heat);
        d.peakHeat = c.peakHeat;
        d.peakStars = HeatLib.stars(c.peakHeat);
        d.lastMovedAt = c.lastMovedAt;
        d.heatZeroAt = heat == 0 ? 0 : uint64(uint256(c.heatUpdatedAt) + uint256(c.heat) * HEAT_DECAY_SECONDS);
    }

    /// @notice The serial and SVG of the next car of `rank`. serial is 0 and svg empty if sold out.
    function previewNext(uint256 rank) external view returns (uint256 serial, string memory svg) {
        if (rank == 0 || rank > RANK_COUNT) revert BadRank();
        serial = uint256(_sold[rank]) + 1;
        if (serial > capOf(rank)) return (0, "");
        svg = IGridlockRenderer(RENDERER).svg(
            IGridlockRenderer.RenderInput({
                rank: uint8(rank),
                serial: uint16(serial),
                heat: 0,
                transferCount: 0,
                peakHeat: 0,
                mintedAt: 0
            })
        );
    }

    /// @notice Hunt state: claimer per hidden index (zero address if unclaimed) and its token id.
    function huntStatus() external view returns (address[12] memory claimers, uint256[12] memory tokenIds) {
        for (uint256 i; i < HUNT_COUNT; ++i) {
            claimers[i] = _huntClaimer[i];
            tokenIds[i] = _huntTokenId[i];
        }
    }

    /// @notice Scan up to `limit` token ids starting at `start` and return those owned by `owner`.
    /// @return ids Owned ids found in the scanned window.
    /// @return next First id not scanned. If next > totalMinted(), the scan is complete.
    function ownedIds(address owner, uint256 start, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 next)
    {
        uint256 last = _lastId;
        uint256 bal = balanceOf(owner);
        uint256 i = start == 0 ? 1 : start;
        uint256 scanned;
        uint256 found;
        ids = new uint256[](bal < limit ? bal : limit);
        while (i <= last && scanned < limit && found < bal) {
            if (_ownerOf(i) == owner) ids[found++] = i;
            ++i;
            ++scanned;
        }
        if (found == bal) i = last + 1;
        next = i;
        assembly {
            mstore(ids, found)
        }
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    /// @dev Time rank `rank` opens, derived only from START_TIME, OPEN_TIMEOUT and sell-out times.
    ///      openedAt(15) = START_TIME; openedAt(k) = min(soldOutAt[k + 1] if set, openedAt(k + 1) + OPEN_TIMEOUT).
    function _openedAt(uint256 rank) internal view returns (uint256 t) {
        t = START_TIME;
        for (uint256 r = RANK_COUNT; r > rank; --r) {
            t = _nextOpen(t, _soldOutAt[r]);
        }
    }

    function _nextOpen(uint256 openedAtRank, uint256 soldOutAtRank) internal view returns (uint256) {
        uint256 deadline = openedAtRank + OPEN_TIMEOUT;
        return (soldOutAtRank != 0 && soldOutAtRank < deadline) ? soldOutAtRank : deadline;
    }

    function _currentHeat(Car memory c) internal view returns (uint256) {
        uint256 stored = c.heat;
        if (stored == 0) return 0;
        uint256 drop = (block.timestamp - c.heatUpdatedAt) / HEAT_DECAY_SECONDS;
        return drop >= stored ? 0 : stored - drop;
    }

    function _renderInput(Car memory c) internal view returns (IGridlockRenderer.RenderInput memory) {
        return IGridlockRenderer.RenderInput({
            rank: c.rank,
            serial: c.serial,
            heat: uint16(_currentHeat(c)),
            transferCount: c.transferCount,
            peakHeat: c.peakHeat,
            mintedAt: c.mintedAt
        });
    }

    /// @dev Heat rises on transfers only (transfer, transferFrom, safeTransferFrom). Not on mint, not on approval.
    function _afterTokenTransfer(address from, address to, uint256 id) internal override {
        if (from == address(0) || to == address(0)) return;
        Car storage c = _cars[id];
        uint256 heat = _currentHeat(c) + HEAT_PER_TRANSFER;
        if (heat > HEAT_MAX) heat = HEAT_MAX;
        c.heat = uint16(heat);
        c.heatUpdatedAt = uint48(block.timestamp);
        if (heat > c.peakHeat) c.peakHeat = uint16(heat);
        if (c.transferCount != type(uint32).max) ++c.transferCount;
        c.lastMovedAt = uint48(block.timestamp);
        emit MetadataUpdate(id);
    }
}
