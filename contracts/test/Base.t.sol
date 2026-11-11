// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {GridlockCars} from "../src/GridlockCars.sol";
import {GridlockRenderer} from "../src/GridlockRenderer.sol";

/// @dev Shared setup. Hunt secrets here are TEST-ONLY values derived from a fixed label. Real secrets never appear in this repo.
abstract contract Base is Test {
    uint64 internal constant START = 1_000_000;
    uint64 internal constant TIMEOUT = 7 days;
    uint64 internal constant DECAY = 3600;
    uint64 internal constant DELAY = 60;

    GridlockRenderer internal renderer;
    GridlockCars internal cars;
    address internal treasury = address(0x7ea5);
    uint16[15] internal caps = [10, 20, 30, 45, 65, 85, 110, 140, 170, 200, 240, 280, 320, 360, 400];

    function testSecret(uint256 i) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("GRIDLOCK-TEST-ONLY-SECRET-", i));
    }

    function params(uint16 capEach) internal view returns (GridlockCars.Params memory p) {
        p.treasury = treasury;
        p.renderer = address(renderer);
        p.startTime = START;
        p.openTimeout = TIMEOUT;
        p.heatDecaySeconds = DECAY;
        p.revealMinDelay = DELAY;
        for (uint256 i; i < 15; ++i) {
            p.caps[i] = capEach == 0 ? caps[i] : capEach;
            p.prices[i] = (15 - i) * 1e15;
        }
        for (uint256 i; i < 12; ++i) p.huntCommitments[i] = keccak256(abi.encodePacked(testSecret(i)));
    }

    function deploy(uint16 capEach) internal {
        renderer = new GridlockRenderer();
        cars = new GridlockCars(params(capEach));
        vm.warp(START);
    }

    function price(uint256 rank) internal pure returns (uint256) {
        return (16 - rank) * 1e15;
    }

    function wallet(uint256 n) internal pure returns (address) {
        return address(uint160(0x10000 + n));
    }

    function walletCap(uint256 rank) internal pure returns (uint256) {
        return rank >= 6 ? 2 : 1;
    }

    function mintAs(address who, uint256 rank, uint256 qty) internal {
        vm.deal(who, price(rank) * qty);
        uint256 serial = cars.soldOf(rank) + 1;
        vm.prank(who);
        cars.mint{value: price(rank) * qty}(rank, qty, serial);
    }

    function sellOut(uint256 rank, uint256 base) internal {
        uint256 cap = cars.capOf(rank);
        uint256 k;
        while (cars.soldOf(rank) < cap) {
            uint256 q = cap - cars.soldOf(rank);
            if (q > walletCap(rank)) q = walletCap(rank);
            mintAs(wallet(base + k++), rank, q);
        }
    }

    function commitment(bytes32 secret, address claimer, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(secret, claimer, salt));
    }

    function claim(address who, uint256 index, bytes32 salt) internal {
        vm.startPrank(who);
        cars.commitClaim(commitment(testSecret(index), who, salt));
        skip(DELAY);
        cars.revealClaim(index, testSecret(index), salt);
        vm.stopPrank();
    }
}
