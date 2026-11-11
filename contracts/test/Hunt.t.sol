// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base} from "./Base.t.sol";
import {GridlockCars} from "../src/GridlockCars.sol";

/// @dev All secrets are TEST-ONLY values from Base.testSecret.
contract HuntTest is Base {
    function setUp() public {
        deploy(0);
    }

    function commit(address who, uint256 index, bytes32 salt) internal {
        vm.prank(who);
        cars.commitClaim(commitment(testSecret(index), who, salt));
    }

    function test_happyPath() public {
        claim(wallet(1), 3, bytes32(uint256(1)));
        (address[12] memory claimers, uint256[12] memory ids) = cars.huntStatus();
        assertEq(claimers[3], wallet(1));
        assertEq(ids[3], 1);
        assertEq(claimers[2], address(0));
        GridlockCars.CarData memory d = cars.carData(1);
        assertTrue(d.hidden);
        assertEq(d.rank, 0);
        assertEq(d.serial, 3);
        assertEq(cars.ownerOf(1), wallet(1));
    }

    function test_wrongSecretIndexSalt() public {
        address w = wallet(1);
        commit(w, 3, bytes32(uint256(1)));
        skip(DELAY);
        vm.startPrank(w);
        vm.expectRevert(GridlockCars.BadSecret.selector);
        cars.revealClaim(4, testSecret(3), bytes32(uint256(1)));
        vm.expectRevert(GridlockCars.CommitMismatch.selector);
        cars.revealClaim(3, testSecret(4), bytes32(uint256(1)));
        vm.expectRevert(GridlockCars.CommitMismatch.selector);
        cars.revealClaim(3, testSecret(3), bytes32(uint256(2)));
        vm.expectRevert(GridlockCars.BadIndex.selector);
        cars.revealClaim(12, testSecret(3), bytes32(uint256(1)));
        vm.stopPrank();
    }

    function test_tooEarly_andExactDelay() public {
        address w = wallet(1);
        vm.prank(w);
        vm.expectRevert(GridlockCars.NoCommit.selector);
        cars.revealClaim(0, testSecret(0), bytes32(uint256(1)));
        commit(w, 0, bytes32(uint256(1)));
        vm.prank(w);
        vm.expectRevert(GridlockCars.RevealTooEarly.selector);
        cars.revealClaim(0, testSecret(0), bytes32(uint256(1)));
        skip(DELAY - 1);
        vm.prank(w);
        vm.expectRevert(GridlockCars.RevealTooEarly.selector);
        cars.revealClaim(0, testSecret(0), bytes32(uint256(1)));
        skip(1);
        vm.prank(w);
        cars.revealClaim(0, testSecret(0), bytes32(uint256(1)));
    }

    function test_otherWalletCannotRevealSomeoneElsesCommitment() public {
        commit(wallet(1), 5, bytes32(uint256(1)));
        skip(DELAY * 10);
        vm.prank(wallet(2));
        vm.expectRevert(GridlockCars.NoCommit.selector);
        cars.revealClaim(5, testSecret(5), bytes32(uint256(1)));
        commit(wallet(2), 6, bytes32(uint256(9)));
        skip(DELAY);
        vm.prank(wallet(2));
        vm.expectRevert(GridlockCars.CommitMismatch.selector);
        cars.revealClaim(5, testSecret(5), bytes32(uint256(1)));
    }

    /// @dev The victim's reveal is visible. The thief replays it, or commits with the leaked secret and reveals at once.
    function test_mempoolTheftSimulation() public {
        address victim = wallet(1);
        address thief = wallet(2);
        commit(victim, 7, bytes32(uint256(1)));
        skip(DELAY);
        vm.prank(thief);
        vm.expectRevert(GridlockCars.NoCommit.selector);
        cars.revealClaim(7, testSecret(7), bytes32(uint256(1)));
        commit(thief, 7, bytes32(uint256(2)));
        vm.prank(thief);
        vm.expectRevert(GridlockCars.RevealTooEarly.selector);
        cars.revealClaim(7, testSecret(7), bytes32(uint256(2)));
        vm.prank(victim);
        cars.revealClaim(7, testSecret(7), bytes32(uint256(1)));
        skip(DELAY);
        vm.prank(thief);
        vm.expectRevert(GridlockCars.AlreadyClaimed.selector);
        cars.revealClaim(7, testSecret(7), bytes32(uint256(2)));
    }

    function test_doubleClaim_andTwoFinders() public {
        address a = wallet(1);
        address b = wallet(2);
        commit(a, 2, bytes32(uint256(1)));
        commit(b, 2, bytes32(uint256(1)));
        skip(DELAY);
        vm.prank(a);
        cars.revealClaim(2, testSecret(2), bytes32(uint256(1)));
        vm.prank(b);
        vm.expectRevert(GridlockCars.AlreadyClaimed.selector);
        cars.revealClaim(2, testSecret(2), bytes32(uint256(1)));
        vm.prank(a);
        vm.expectRevert(GridlockCars.NoCommit.selector);
        cars.revealClaim(2, testSecret(2), bytes32(uint256(1)));
    }

    function test_emptyCommitmentRejected() public {
        vm.expectRevert(GridlockCars.EmptyCommitment.selector);
        cars.commitClaim(bytes32(0));
    }

    function test_twelveCarsAtMost_noWalletCaps() public {
        for (uint256 i; i < 12; ++i) claim(wallet(1), i, bytes32(i + 1));
        assertEq(cars.totalMinted(), 12);
        assertEq(cars.balanceOf(wallet(1)), 12);
        GridlockCars.RungInfo[15] memory l = cars.ladderState();
        for (uint256 i; i < 15; ++i) assertEq(l[i].sold, 0);
        vm.prank(wallet(1));
        vm.expectRevert(GridlockCars.BadIndex.selector);
        cars.revealClaim(12, testSecret(0), bytes32(uint256(1)));
    }
}
