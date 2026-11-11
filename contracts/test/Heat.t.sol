// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base} from "./Base.t.sol";
import {GridlockCars} from "../src/GridlockCars.sol";

contract HeatTest is Base {
    address internal a = wallet(1);
    address internal b = wallet(2);

    event MetadataUpdate(uint256 _tokenId);

    function setUp() public {
        deploy(0);
        mintAs(a, 15, 1); // token 1, owned by a
    }

    function heat() internal view returns (uint256) {
        return cars.carData(1).heat;
    }

    function test_mintAndApprovalAddNoHeat() public {
        assertEq(heat(), 0);
        vm.startPrank(a);
        cars.approve(b, 1);
        cars.setApprovalForAll(b, true);
        vm.stopPrank();
        GridlockCars.CarData memory d = cars.carData(1);
        assertEq(d.heat, 0);
        assertEq(d.transferCount, 0);
        assertEq(d.lastMovedAt, 0);
    }

    function test_transferFrom_and_safeTransferFrom_addHeat() public {
        vm.expectEmit(false, false, false, true, address(cars));
        emit MetadataUpdate(1);
        vm.prank(a);
        cars.transferFrom(a, b, 1);
        GridlockCars.CarData memory d = cars.carData(1);
        assertEq(d.heat, 20);
        assertEq(d.transferCount, 1);
        assertEq(d.peakHeat, 20);
        assertEq(d.stars, 2);
        vm.prank(b);
        cars.safeTransferFrom(b, a, 1);
        assertEq(heat(), 40);
        assertEq(cars.carData(1).transferCount, 2);
    }

    function test_decayAndNeverNegative() public {
        vm.prank(a);
        cars.transferFrom(a, b, 1);
        uint256[8] memory dts = [uint256(0), 3599, 3600, 7199, 7200, 19 * 3600, 20 * 3600, 10_000 * 3600];
        uint256[8] memory want = [uint256(20), 20, 19, 19, 18, 1, 0, 0];
        for (uint256 i; i < 8; ++i) {
            vm.warp(START + dts[i]);
            assertEq(heat(), want[i]);
        }
    }

    function test_capAt150() public {
        address from = a;
        address to = b;
        for (uint256 i; i < 12; ++i) {
            vm.prank(from);
            cars.transferFrom(from, to, 1);
            (from, to) = (to, from);
        }
        assertEq(heat(), 150);
        assertEq(cars.carData(1).peakHeat, 150);
        assertEq(cars.carData(1).stars, 5);
    }

    function test_starsAtEveryThreshold() public {
        address from = a;
        address to = b;
        for (uint256 i; i < 6; ++i) {
            vm.prank(from);
            cars.transferFrom(from, to, 1);
            (from, to) = (to, from);
        }
        uint256[10] memory h = [uint256(120), 119, 80, 79, 45, 44, 20, 19, 1, 0];
        uint8[10] memory s = [uint8(5), 4, 4, 3, 3, 2, 2, 1, 1, 0];
        for (uint256 i; i < 10; ++i) {
            vm.warp(START + (120 - h[i]) * DECAY);
            GridlockCars.CarData memory d = cars.carData(1);
            assertEq(d.heat, h[i]);
            assertEq(d.stars, s[i]);
        }
        assertEq(cars.carData(1).peakStars, 5);
    }

    function test_heatZeroAtMatchesDecay() public {
        vm.prank(a);
        cars.transferFrom(a, b, 1);
        vm.prank(b);
        cars.transferFrom(b, a, 1); // heat 40
        uint64 z = cars.carData(1).heatZeroAt;
        assertEq(z, START + 40 * DECAY);
        vm.warp(z - 1);
        assertEq(heat(), 1);
        vm.warp(z);
        assertEq(heat(), 0);
        assertEq(cars.carData(1).heatZeroAt, 0);
    }

    function testFuzz_heatNeverExceedsMaxOrUnderflows(uint32 transfers, uint32 dt) public {
        uint256 n = bound(transfers, 0, 20);
        address from = a;
        address to = b;
        for (uint256 i; i < n; ++i) {
            vm.prank(from);
            cars.transferFrom(from, to, 1);
            (from, to) = (to, from);
        }
        vm.warp(block.timestamp + dt);
        assertLe(heat(), 150);
        assertLe(cars.carData(1).heat, cars.carData(1).peakHeat);
    }

    function test_erc165_and_royalty() public view {
        assertTrue(cars.supportsInterface(0x01ffc9a7));
        assertTrue(cars.supportsInterface(0x80ac58cd));
        assertTrue(cars.supportsInterface(0x5b5e139f));
        assertTrue(cars.supportsInterface(0x2a55205a));
        assertTrue(cars.supportsInterface(0x49064906));
        assertFalse(cars.supportsInterface(0xffffffff));
        (address r, uint256 amt) = cars.royaltyInfo(1, 1 ether);
        assertEq(r, treasury);
        assertEq(amt, 0.05 ether);
    }
}
