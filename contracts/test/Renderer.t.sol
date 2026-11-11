// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base} from "./Base.t.sol";
import {IGridlockRenderer} from "../src/IGridlockRenderer.sol";

contract RendererTest is Base {
    function setUp() public {
        deploy(0);
    }

    function input(uint8 rank, uint16 serial, uint16 heat) internal pure returns (IGridlockRenderer.RenderInput memory) {
        return IGridlockRenderer.RenderInput(rank, serial, heat, 0, heat, 0);
    }

    function test_deterministic_andDifferent() public view {
        assertEq(keccak256(bytes(renderer.svg(input(12, 7, 0)))), keccak256(bytes(renderer.svg(input(12, 7, 0)))));
        assertTrue(keccak256(bytes(renderer.svg(input(12, 7, 0)))) != keccak256(bytes(renderer.svg(input(12, 8, 0)))));
        assertTrue(keccak256(bytes(renderer.svg(input(12, 7, 0)))) != keccak256(bytes(renderer.svg(input(11, 7, 0)))));
        assertTrue(keccak256(bytes(renderer.svg(input(0, 3, 0)))) != keccak256(bytes(renderer.svg(input(0, 4, 0)))));
        assertTrue(keccak256(bytes(renderer.svg(input(12, 7, 0)))) != keccak256(bytes(renderer.svg(input(12, 7, 20)))));
    }

    function test_svgSafeCharacters() public view {
        for (uint8 rank; rank <= 15; ++rank) {
            bytes memory s = bytes(renderer.svg(input(rank, rank == 0 ? 5 : 3, 80)));
            for (uint256 i; i < s.length; ++i) {
                assertTrue(s[i] >= 0x20 && s[i] <= 0x7e, "printable ascii");
                assertTrue(s[i] != '"' && s[i] != "&", "no double quote or ampersand");
            }
            assertFalse(contains(s, "<script"));
            assertFalse(contains(s, "<pattern"));
            assertFalse(contains(s, "href"));
            assertFalse(contains(s, "<text"));
            assertFalse(contains(s, "<animate"));
        }
    }

    function test_tokenURI_gasBelow3M() public {
        uint256 worst;
        for (uint8 rank; rank <= 15; ++rank) {
            IGridlockRenderer.RenderInput memory p = IGridlockRenderer.RenderInput(rank, rank == 0 ? 11 : 400, 150, 4_294_967_295, 150, type(uint48).max);
            uint256 g = gasleft();
            renderer.tokenURI(2487, p);
            uint256 used = g - gasleft();
            if (used > worst) worst = used;
        }
        emit log_named_uint("worst tokenURI gas", worst);
        assertLt(worst, 3_000_000);
    }

    mapping(bytes32 => bool) internal seenHash;

    /// @dev Reports the unique image count over every rank and serial plus the 12 hidden cars.
    function test_uniqueImages_allCombinations() public {
        uint256 n;
        uint256 dup;
        for (uint8 rank = 1; rank <= 15; ++rank) {
            for (uint16 s = 1; s <= caps[rank - 1]; ++s) {
                bytes32 h = keccak256(bytes(renderer.svg(input(rank, s, 0))));
                if (seenHash[h]) ++dup;
                seenHash[h] = true;
                ++n;
            }
        }
        for (uint16 i; i < 12; ++i) {
            bytes32 h = keccak256(bytes(renderer.svg(input(0, i, 0))));
            if (seenHash[h]) ++dup;
            seenHash[h] = true;
            ++n;
        }
        emit log_named_uint("images", n);
        emit log_named_uint("duplicate images", dup);
        assertEq(n, 2487);
        assertEq(dup, 0);
    }

    function test_rank1CardRenders() public view {
        assertGt(bytes(renderer.svg(input(1, 1, 0))).length, 4000);
    }

    function contains(bytes memory hay, bytes memory needle) internal pure returns (bool) {
        if (needle.length > hay.length) return false;
        for (uint256 i; i + needle.length <= hay.length; ++i) {
            bool ok = true;
            for (uint256 j; j < needle.length; ++j) {
                if (hay[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
