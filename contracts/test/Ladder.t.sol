// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base} from "./Base.t.sol";
import {GridlockCars} from "../src/GridlockCars.sol";
import {GridlockRenderer} from "../src/GridlockRenderer.sol";

contract LadderTest is Base {
    function test_constructor_rejectsBadInputs() public {
        renderer = new GridlockRenderer();
        GridlockCars.Params memory p = params(0);
        p.prices[3] = p.prices[4] - 1; // not monotone
        vm.expectRevert(GridlockCars.InvalidPrices.selector);
        new GridlockCars(p);

        p = params(0);
        p.prices[14] = 0;
        vm.expectRevert(GridlockCars.InvalidPrices.selector);
        new GridlockCars(p);

        p = params(0);
        p.caps[2] = 0;
        vm.expectRevert(GridlockCars.InvalidCaps.selector);
        new GridlockCars(p);

        p = params(0);
        p.treasury = address(0);
        vm.expectRevert(GridlockCars.InvalidTreasury.selector);
        new GridlockCars(p);

        p = params(0);
        p.renderer = address(0xdead01);
        vm.expectRevert(GridlockCars.InvalidRenderer.selector);
        new GridlockCars(p);

        p = params(0);
        p.openTimeout = 0;
        vm.expectRevert(GridlockCars.InvalidTimes.selector);
        new GridlockCars(p);

        p = params(0);
        p.huntCommitments[5] = p.huntCommitments[2];
        vm.expectRevert(GridlockCars.InvalidHuntCommitments.selector);
        new GridlockCars(p);
    }

    function test_rank15_opensAtStart() public {
        deploy(0);
        vm.warp(START - 1);
        vm.deal(wallet(1), 1 ether);
        vm.prank(wallet(1));
        vm.expectRevert(GridlockCars.NotOpen.selector);
        cars.mint{value: price(15)}(15, 1, 1);
        vm.warp(START);
        mintAs(wallet(1), 15, 1);
        vm.expectRevert(GridlockCars.NotOpen.selector);
        this.mintExt(wallet(2), 14);
    }

    function mintExt(address who, uint256 rank) external {
        mintAs(who, rank, 1);
    }

    function test_rank14_opensByTimeout_boundaries() public {
        deploy(0);
        vm.warp(START + TIMEOUT - 1);
        vm.expectRevert(GridlockCars.NotOpen.selector);
        this.mintExt(wallet(1), 14);
        vm.warp(START + TIMEOUT);
        mintAs(wallet(1), 14, 1);
    }

    function test_soldOutFasterThanTimeout() public {
        deploy(3);
        vm.warp(START + 100);
        sellOut(15, 1000);
        GridlockCars.RungInfo[15] memory l = cars.ladderState();
        assertEq(l[14].soldOutAt, START + 100);
        assertEq(l[13].opensAtLatest, START + 100);
        assertTrue(l[13].isOpen);
        mintAs(wallet(5000), 14, 1);
        assertEq(cars.ladderState()[12].opensAtLatest, START + 100 + TIMEOUT);
    }

    function test_timeoutFasterThanSoldOut_andSoldOutAfterTimeout() public {
        deploy(3);
        vm.warp(START + TIMEOUT + 5);
        mintAs(wallet(1), 15, 2);
        mintAs(wallet(2), 14, 1); // open by timeout
        vm.warp(START + TIMEOUT + 3 days);
        mintAs(wallet(3), 15, 1); // sells out rank 15 after openedAt(14)
        GridlockCars.RungInfo[15] memory l = cars.ladderState();
        assertEq(l[14].soldOutAt, START + TIMEOUT + 3 days);
        assertEq(l[13].opensAtLatest, START + TIMEOUT);
    }

    function test_chain_ofRanks() public {
        deploy(3);
        vm.warp(START + 50);
        sellOut(15, 1000);
        vm.warp(START + 60);
        sellOut(14, 2000);
        GridlockCars.RungInfo[15] memory l = cars.ladderState();
        assertEq(l[12].opensAtLatest, START + 60);
        assertEq(l[11].opensAtLatest, START + 60 + TIMEOUT);
        vm.warp(START + 60 + TIMEOUT - 1);
        vm.expectRevert(GridlockCars.NotOpen.selector);
        this.mintExt(wallet(900), 12);
        vm.warp(START + 60 + TIMEOUT);
        mintAs(wallet(900), 12, 1);
    }

    function test_mintRules() public {
        deploy(3);
        address w = wallet(1);
        vm.deal(w, 100 ether);
        vm.startPrank(w);
        vm.expectRevert(GridlockCars.BadRank.selector);
        cars.mint{value: 0}(0, 1, 1);
        vm.expectRevert(GridlockCars.BadRank.selector);
        cars.mint{value: 0}(16, 1, 1);
        vm.expectRevert(GridlockCars.BadQuantity.selector);
        cars.mint{value: 0}(15, 0, 1);
        vm.expectRevert(GridlockCars.BadQuantity.selector);
        cars.mint{value: 3 * price(15)}(15, 3, 1);
        vm.expectRevert(GridlockCars.WrongPayment.selector);
        cars.mint{value: price(15) - 1}(15, 1, 1);
        vm.expectRevert(GridlockCars.WrongPayment.selector);
        cars.mint{value: price(15) + 1}(15, 1, 1);
        vm.expectRevert(abi.encodeWithSelector(GridlockCars.SerialMismatch.selector, 1));
        cars.mint{value: price(15)}(15, 1, 2);
        cars.mint{value: 2 * price(15)}(15, 2, 1);
        vm.expectRevert(GridlockCars.WalletCapReached.selector);
        cars.mint{value: price(15)}(15, 1, 3);
        vm.stopPrank();
        vm.deal(wallet(2), 100 ether);
        vm.prank(wallet(2));
        vm.expectRevert(GridlockCars.NotEnoughLeft.selector);
        cars.mint{value: 2 * price(15)}(15, 2, 3);
        mintAs(wallet(2), 15, 1);
        vm.expectRevert(GridlockCars.SoldOut.selector);
        this.mintExt(wallet(3), 15);
        // ranks 5 to 1: one per wallet
        vm.warp(START + 14 * TIMEOUT);
        mintAs(wallet(9), 5, 1);
        vm.expectRevert(GridlockCars.WalletCapReached.selector);
        this.mintExt(wallet(9), 5);
        vm.deal(wallet(10), 100 ether);
        vm.prank(wallet(10));
        vm.expectRevert(GridlockCars.WalletCapReached.selector);
        cars.mint{value: 2 * price(5)}(5, 2, 2);
    }

    function testFuzz_paymentMustBeExact(uint256 value) public {
        deploy(0);
        vm.deal(wallet(1), value);
        vm.prank(wallet(1));
        if (value == price(15)) {
            cars.mint{value: value}(15, 1, 1);
        } else if (value == 2 * price(15)) {
            vm.expectRevert(abi.encodeWithSelector(GridlockCars.WrongPayment.selector));
            cars.mint{value: value}(15, 1, 1);
        } else {
            vm.expectRevert(GridlockCars.WrongPayment.selector);
            cars.mint{value: value}(15, 1, 1);
        }
    }

    function test_fullLadder_total2475plus12_andEth() public {
        deploy(0);
        uint256 total;
        uint256 revenue;
        for (uint256 rank = 15; rank >= 1; --rank) {
            sellOut(rank, rank * 100_000);
            total += cars.soldOf(rank);
            revenue += cars.soldOf(rank) * price(rank);
            vm.expectRevert(GridlockCars.SoldOut.selector);
            this.mintExt(wallet(9_999_999), rank);
            skip(1);
        }
        assertEq(total, 2475);
        assertEq(cars.totalMinted(), 2475);
        for (uint256 i; i < 12; ++i) claim(wallet(8_000_000 + i), i, bytes32(i + 1));
        assertEq(cars.totalMinted(), 2487);
        assertEq(address(cars).balance, revenue);
        uint256 before = treasury.balance;
        cars.withdraw();
        assertEq(address(cars).balance, 0);
        assertEq(treasury.balance - before, revenue);
    }

    function test_withdraw_onlyToTreasury_anyoneCanCall_noReceive() public {
        deploy(3);
        mintAs(wallet(1), 15, 2);
        vm.prank(wallet(77));
        cars.withdraw();
        assertEq(treasury.balance, 2 * price(15));
        vm.deal(wallet(5), 1 ether);
        vm.prank(wallet(5));
        (bool ok,) = address(cars).call{value: 1}("");
        assertFalse(ok);
    }
}
