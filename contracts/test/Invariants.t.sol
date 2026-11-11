// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base} from "./Base.t.sol";
import {GridlockCars} from "../src/GridlockCars.sol";

contract Handler is Base {
    uint256 public paid;
    uint256 public withdrawn;
    address[] internal actors;
    uint256[] public tokenIds;

    constructor(GridlockCars c) {
        cars = c;
        for (uint256 i = 1; i <= 5; ++i) actors.push(wallet(i));
    }

    function mintOne(uint256 actorSeed, uint256 rankSeed, uint256 qtySeed, uint256 dt) external {
        vm.warp(block.timestamp + (dt % 4 days));
        address who = actors[actorSeed % actors.length];
        uint256 rank = 1 + (rankSeed % 15);
        uint256 qty = 1 + (qtySeed % 2);
        uint256 value = price(rank) * qty;
        vm.deal(who, value);
        uint256 serial = cars.soldOf(rank) + 1;
        vm.prank(who);
        try cars.mint{value: value}(rank, qty, serial) {
            paid += value;
            tokenIds.push(cars.totalMinted());
            if (qty == 2) tokenIds.push(cars.totalMinted() - 1);
        } catch {}
    }

    function transferOne(uint256 idSeed, uint256 toSeed) external {
        if (tokenIds.length == 0) return;
        uint256 id = tokenIds[idSeed % tokenIds.length];
        address from = cars.ownerOf(id);
        vm.prank(from);
        cars.transferFrom(from, actors[toSeed % actors.length], id);
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + (dt % 3 days));
    }

    function withdraw() external {
        withdrawn += address(cars).balance;
        cars.withdraw();
    }

    function ids() external view returns (uint256) {
        return tokenIds.length;
    }
}

contract InvariantsTest is Base {
    Handler internal h;

    function setUp() public {
        deploy(3);
        h = new Handler(cars);
        targetContract(address(h));
    }

    function invariant_soldNeverExceedsCap_andTotalIsSum() public view {
        uint256 total;
        for (uint256 r = 1; r <= 15; ++r) {
            assertLe(cars.soldOf(r), cars.capOf(r));
            total += cars.soldOf(r);
        }
        assertEq(cars.totalMinted(), total);
        assertLe(cars.totalMinted(), 2487);
    }

    function invariant_ethEqualsPaymentsMinusWithdrawn() public view {
        assertEq(address(cars).balance + h.withdrawn(), h.paid());
    }

    function invariant_heatBounded() public view {
        uint256 n = cars.totalMinted();
        for (uint256 id = 1; id <= n; ++id) {
            GridlockCars.CarData memory d = cars.carData(id);
            assertLe(d.heat, 150);
            assertLe(d.heat, d.peakHeat);
        }
    }

    function invariant_walletCaps() public view {
        for (uint256 i = 1; i <= 5; ++i) {
            for (uint256 r = 1; r <= 15; ++r) assertLe(cars.walletMinted(wallet(i), r), cars.walletRankCap(r));
        }
    }
}
