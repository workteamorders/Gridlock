// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @notice Pure rendering interface. The renderer holds no state and has no owner.
interface IGridlockRenderer {
    /// @dev rank 0 means a hidden car, and `serial` is then the hunt index (0 to 11).
    struct RenderInput {
        uint8 rank;
        uint16 serial;
        uint16 heat;
        uint32 transferCount;
        uint16 peakHeat;
        uint48 mintedAt;
    }

    /// @notice Raw SVG markup for a car.
    function svg(RenderInput calldata input) external pure returns (string memory);

    /// @notice `data:application/json;base64,...` metadata with the SVG as a data URI image.
    function tokenURI(uint256 id, RenderInput calldata input) external pure returns (string memory);
}
