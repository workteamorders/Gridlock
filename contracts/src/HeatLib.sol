// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @notice Heat constants and star thresholds shared by the cars contract and the renderer.
/// @dev Heat is display only. It is never used for rank, rights, price or any rule.
library HeatLib {
    uint256 internal constant PER_TRANSFER = 20;
    uint256 internal constant MAX = 150;

    uint256 internal constant STAR_1 = 1;
    uint256 internal constant STAR_2 = 20;
    uint256 internal constant STAR_3 = 45;
    uint256 internal constant STAR_4 = 80;
    uint256 internal constant STAR_5 = 120;

    /// @notice Number of stars (0 to 5) for a heat value.
    function stars(uint256 heat) internal pure returns (uint8) {
        if (heat >= STAR_5) return 5;
        if (heat >= STAR_4) return 4;
        if (heat >= STAR_3) return 3;
        if (heat >= STAR_2) return 2;
        if (heat >= STAR_1) return 1;
        return 0;
    }
}
