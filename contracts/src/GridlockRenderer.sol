// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";
import {GridlockVehicle} from "./GridlockVehicle.sol";
import {HeatLib} from "./HeatLib.sol";
import {IGridlockRenderer} from "./IGridlockRenderer.sol";

/// @title Gridlock Renderer
/// @notice Pure SVG and metadata renderer for Gridlock Cars. No state, no owner, no free text.
/// @dev Output is standalone SVG: literal colors, attributes only (no style element), no pattern, no clipPath,
///      no filter, no script, no animation, no external reference. Letters and digits are stroked paths, not text.
///      Every string comes from the fixed tables in this file.
contract GridlockRenderer is IGridlockRenderer {
    using LibString for uint256;

    // Palette: flat ink in black, red and yellow, plus a few body colors.
    string private constant INK = "#0b0b0c";
    string private constant PAPER = "#1a1917";
    string private constant PAPER2 = "#262420";
    string private constant CREAM = "#f2eee3";
    string private constant YEL = "#ffc61a";
    string private constant RED = "#e4262b";
    string private constant DIM = "#6b675f";

    struct Theme {
        string paper; // card background
        string ink; // frame, outlines and text on paper
        string band; // title band
        string bandInk; // title letters
        string starOn;
        string starOnStroke;
        string starOff;
        uint8 tier; // 0 plain, 1 ticks, 2 inner frame, 3 burst (rank 1)
        bool hidden;
    }

    /*//////////////////////////////////////////////////////////////
                              PUBLIC API
    //////////////////////////////////////////////////////////////*/

    function svg(RenderInput calldata input) external pure returns (string memory) {
        return _svg(input);
    }

    function tokenURI(uint256 id, RenderInput calldata input) external pure returns (string memory) {
        string memory image = string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(_svg(input)))));
        bytes memory json = abi.encodePacked(
            '{"name":"Gridlock #',
            id.toString(),
            '","description":"A fictional comic wanted-poster car. Heat shows how recently this car changed hands and fades with time. It changes nothing else. Marketplaces may show a cached image; the Gridlock site shows the current state.","image":"',
            image,
            '","attributes":',
            _attributes(input),
            "}"
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function _attributes(RenderInput calldata p) private pure returns (string memory) {
        bytes memory a = abi.encodePacked(
            '[{"trait_type":"rank","display_type":"number","value":', uint256(p.rank).toString(),
            '},{"trait_type":"serial","display_type":"number","value":', uint256(p.serial).toString(),
            '},{"trait_type":"hidden","value":"', p.rank == 0 ? "Yes" : "No", '"}'
        );
        bytes memory b = abi.encodePacked(
            ',{"trait_type":"heat_stars","display_type":"number","value":', uint256(HeatLib.stars(p.heat)).toString(),
            '},{"trait_type":"transfers","display_type":"number","value":', uint256(p.transferCount).toString(),
            '},{"trait_type":"peak_stars","display_type":"number","value":', uint256(HeatLib.stars(p.peakHeat)).toString(),
            '},{"trait_type":"minted_at","display_type":"date","value":', uint256(p.mintedAt).toString(), "}]"
        );
        return string(abi.encodePacked(a, b));
    }

    /*//////////////////////////////////////////////////////////////
                               SVG BUILD
    //////////////////////////////////////////////////////////////*/

    function _svg(RenderInput memory p) private pure returns (string memory) {
        Theme memory t = _theme(p.rank);
        bytes32 h = keccak256(abi.encode("gridlock/0", uint256(p.rank), uint256(p.serial)));
        return string(
            abi.encodePacked(
                _frame(t),
                _title(t),
                _backdrop(t),
                t.hidden ? _hiddenCar(p.serial) : _car(h, p.rank, p.serial),
                _rankNumber(t, p.rank),
                _plate(h, t, p.serial),
                _stars(t, HeatLib.stars(p.heat)),
                _rapSheet(t, p),
                _tail(t)
            )
        );
    }

    function _theme(uint8 rank) private pure returns (Theme memory t) {
        if (rank == 0) {
            t = Theme(INK, CREAM, PAPER2, YEL, YEL, YEL, DIM, 2, true);
        } else if (rank == 1) {
            t = Theme(YEL, INK, RED, CREAM, RED, INK, INK, 3, false);
        } else {
            t = Theme(PAPER, CREAM, YEL, INK, YEL, YEL, DIM, rank >= 11 ? 0 : rank >= 6 ? 1 : 2, false);
        }
    }

    function _frame(Theme memory t) private pure returns (string memory) {
        string memory dash = t.hidden ? " stroke-dasharray='14 8'" : "";
        string memory decor;
        if (t.tier == 1) {
            decor = string(
                abi.encodePacked(
                    "<path d='M14 34V14H34M266 14H286V34M286 386V406H266M34 406H14V386' fill='none' stroke='",
                    t.ink,
                    "' stroke-width='3'/>"
                )
            );
        } else if (t.tier >= 2) {
            decor = string(
                abi.encodePacked(
                    "<rect x='12' y='12' width='276' height='396' fill='none' stroke='",
                    t.tier == 3 ? RED : YEL,
                    "' stroke-width='3'/>"
                )
            );
        }
        return string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 420' width='300' height='420'>",
                "<rect x='3' y='3' width='294' height='414' fill='",
                t.paper,
                "' stroke='",
                t.ink,
                "' stroke-width='6'",
                dash,
                "/>",
                decor
            )
        );
    }

    function _title(Theme memory t) private pure returns (string memory) {
        // "WANTED" for cars, "REDACTED" for hidden cars. Letters are paths.
        string memory letters = t.hidden
            ? _glyphs("REDACTED", 46, 11, "0.5", 26, t.bandInk, 12)
            : _glyphs("WANTED", 62, 9, "0.62", 30, t.bandInk, 10);
        return string(abi.encodePacked("<rect x='3' y='3' width='294' height='52' fill='", t.band, "'/>", letters));
    }

    function _backdrop(Theme memory t) private pure returns (string memory) {
        // Red brush slash, speed lines, halftone dots (plain circles, no pattern element).
        string memory dots = _dots(t.tier == 3 ? INK : CREAM);
        return string(
            abi.encodePacked(
                "<polygon points='3,168 297,92 297,176 3,252' fill='",
                RED,
                "'/><path d='M10 112H48M6 128H40M12 144H46' fill='none' stroke='",
                t.tier == 3 ? INK : CREAM,
                "' stroke-width='4' stroke-linecap='round'/>",
                dots
            )
        );
    }

    function _dots(string memory color) private pure returns (string memory out) {
        out = string(abi.encodePacked("<g fill='", color, "' fill-opacity='0.5'>"));
        for (uint256 row; row < 3; ++row) {
            uint256 count = 13 - row * 2;
            uint256 r = 4 - row;
            for (uint256 j; j < count; ++j) {
                out = string(
                    abi.encodePacked(
                        out,
                        "<circle cx='",
                        (152 + j * 11).toString(),
                        "' cy='",
                        (190 + row * 10).toString(),
                        "' r='",
                        r.toString(),
                        "'/>"
                    )
                );
            }
        }
        out = string(abi.encodePacked(out, "</g>"));
    }

    function _tail(Theme memory t) private pure returns (string memory) {
        return string(
            abi.encodePacked(
                "<path d='M3 410l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7l12 -7l12 7L297 420L3 420Z' fill='",
                t.hidden ? PAPER2 : PAPER,
                "'/></svg>"
            )
        );
    }

    /*//////////////////////////////////////////////////////////////
                                   CAR
    //////////////////////////////////////////////////////////////*/

    function _car(bytes32 h, uint8 rank, uint16 serial) private pure returns (string memory) {
        return string(abi.encodePacked(
            "<g transform='translate(9 70) scale(.94)'>",
            GridlockVehicle.draw(uint8(h[0]) % 6, uint8(h[1]) % 2 == 0 ? RED : YEL, uint256(rank) * 512 + serial),
            "</g>"
        ));
    }

    function _hiddenCar(uint16 index) private pure returns (string memory) {
        return string(abi.encodePacked(
            "<g transform='translate(9 70) scale(.94)'>",
            GridlockVehicle.draw(index % 6, index < 6 ? RED : YEL, 8192 + index),
            "</g>"
        ));
    }

    /*//////////////////////////////////////////////////////////////
                         RANK, PLATE, STARS, RAP SHEET
    //////////////////////////////////////////////////////////////*/

    function _rankNumber(Theme memory t, uint8 rank) private pure returns (string memory) {
        string memory s = t.hidden ? "??" : rank < 10 ? string(abi.encodePacked("0", uint256(rank).toString())) : uint256(rank).toString();
        string memory burst = t.tier == 3
            ? string(
                abi.encodePacked(
                    "<polygon points='78,250 91,263 109,256 115,273 134,273 132,290 148,298 138,312 148,326 132,334 134,351 115,351 109,368 91,361 78,374 65,361 47,368 41,351 22,351 24,334 8,326 18,312 8,298 24,290 22,273 41,273 47,256 65,263' fill='",
                    CREAM,
                    "' stroke='",
                    INK,
                    "' stroke-width='3'/>"
                )
            )
            : "";
        return string(abi.encodePacked(burst, _glyphs(bytes(s), 24, 276, "1.15", 52, t.ink, 9)));
    }

    function _plate(bytes32 h, Theme memory t, uint16 serial) private pure returns (string memory) {
        bytes memory digits = new bytes(6);
        if (t.hidden) {
            // Hidden plates are "00-NN" with the hunt index.
            digits[0] = "0";
            digits[1] = "0";
            digits[2] = "-";
            digits[3] = "0";
            digits[4] = bytes1(uint8(48 + (serial / 10) % 10));
            digits[5] = bytes1(uint8(48 + serial % 10));
        } else {
            digits[0] = bytes1(uint8(48 + uint8(h[4]) % 10));
            digits[1] = bytes1(uint8(48 + uint8(h[5]) % 10));
            digits[2] = "-";
            digits[3] = bytes1(uint8(48 + uint8(h[6]) % 10));
            digits[4] = bytes1(uint8(48 + uint8(h[7]) % 10));
            digits[5] = bytes1(uint8(48 + uint8(h[8]) % 10));
        }
        string memory tag = string(abi.encodePacked("#", uint256(serial).toString()));
        return string(
            abi.encodePacked(
                "<rect x='170' y='296' width='110' height='38' fill='",
                PAPER,
                "' stroke='",
                t.ink,
                "' stroke-width='3'/>",
                _glyphs(digits, 176, 303, "0.36", 17, CREAM, 11),
                _glyphs(bytes(tag), 176, 266, "0.34", 17, t.ink, 11)
            )
        );
    }

    function _stars(Theme memory t, uint256 n) private pure returns (string memory out) {
        out = "<g transform='translate(170 346)' stroke-width='1.8' stroke-linejoin='round'>";
        for (uint256 i; i < 5; ++i) {
            bool on = i < n;
            out = string(
                abi.encodePacked(
                    out,
                    "<polygon transform='translate(",
                    (i * 22).toString(),
                    " 0)' points='10,0 12.6,6.6 19.5,7 14.2,11.3 16,18.2 10,14.4 4,18.2 5.8,11.3 0.5,7 7.4,6.6' fill='",
                    on ? t.starOn : "none",
                    "' stroke='",
                    on ? t.starOnStroke : t.starOff,
                    "'/>"
                )
            );
        }
        out = string(abi.encodePacked(out, "</g>"));
    }

    function _rapSheet(Theme memory t, RenderInput memory p) private pure returns (string memory) {
        uint256 transfers = p.transferCount > 99999 ? 99999 : p.transferCount;
        return string(
            abi.encodePacked(
                // Transfer icon and count.
                "<g transform='translate(22 376) scale(0.6)' fill='none' stroke='",
                t.ink,
                "' stroke-width='5' stroke-linejoin='miter'><path d='M4 10H30M22 3L30 10L22 17M30 30H4M12 23L4 30L12 37'/></g>",
                _glyphs(bytes(transfers.toString()), 48, 378, "0.3", 15, t.ink, 12),
                // Peak icon and peak heat.
                "<g transform='translate(160 376) scale(0.6)' fill='none' stroke='",
                t.ink,
                "' stroke-width='5' stroke-linejoin='miter'><path d='M3 34L17 6L31 34Z'/></g>",
                _glyphs(bytes(uint256(p.peakHeat).toString()), 186, 378, "0.3", 15, t.ink, 12)
            )
        );
    }

    /*//////////////////////////////////////////////////////////////
                                  GLYPHS
    //////////////////////////////////////////////////////////////*/

    /// @dev Draws `s` as stroked paths. Each glyph lives in a 40 x 64 box.
    function _glyphs(
        bytes memory s,
        uint256 x,
        uint256 y,
        string memory scale,
        uint256 advance,
        string memory color,
        uint256 strokeWidth
    ) private pure returns (string memory) {
        bytes memory out = abi.encodePacked(
            "<g fill='none' stroke='", color, "' stroke-width='", strokeWidth.toString(), "' stroke-linejoin='miter' stroke-linecap='butt'>"
        );
        for (uint256 i; i < s.length; ++i) {
            string memory d = _glyph(s[i]);
            if (bytes(d).length == 0) continue;
            out = abi.encodePacked(
                out, "<path d='", d, "' transform='translate(", (x + i * advance).toString(), " ", y.toString(), ") scale(", scale, ")'/>"
            );
        }
        return string(abi.encodePacked(out, "</g>"));
    }

    function _glyph(bytes1 c) private pure returns (string memory) {
        if (c == "0") return "M10 5H30L35 12V52L30 59H10L5 52V12Z";
        if (c == "1") return "M8 18L22 5V59M8 59H36";
        if (c == "2") return "M5 16L13 5H29L35 13V26L5 59H36";
        if (c == "3") return "M6 12L12 5H29L35 12V24L27 32L35 40V52L29 59H12L5 52M16 32H27";
        if (c == "4") return "M29 59V5L5 42H37";
        if (c == "5") return "M34 5H10L6 30H27L35 38V52L29 59H10L5 52";
        if (c == "6") return "M31 8L26 5H13L5 13V52L13 59H27L35 52V40L27 32H5";
        if (c == "7") return "M5 5H35L15 59";
        if (c == "8") return "M12 5H28L34 11V25L28 32H12L6 25V11ZM12 32H28L35 39V53L28 59H12L5 53V39Z";
        if (c == "9") return "M9 56L14 59H27L35 51V12L27 5H13L5 12V25L13 32H35";
        if (c == "A") return "M5 59L20 5L35 59M12 38H28";
        if (c == "C") return "M35 14L28 5H12L5 14V50L12 59H28L35 50";
        if (c == "D") return "M5 5H24L35 16V48L24 59H5Z";
        if (c == "E") return "M35 5H5V59H35M5 32H28";
        if (c == "K") return "M5 5V59M35 5L5 36M14 28L35 59";
        if (c == "N") return "M5 59V5L35 59V5";
        if (c == "R") return "M5 59V5H26L35 14V26L26 35H5M22 35L35 59";
        if (c == "T") return "M3 5H37M20 5V59";
        if (c == "W") return "M3 5L11 59L20 28L29 59L37 5";
        if (c == "?") return "M8 16L14 6H26L34 14V26L20 38V44M20 54V59";
        if (c == "#") return "M13 5L10 59M30 5L27 59M3 22H37M3 42H37";
        if (c == "-") return "M8 32H32";
        return "";
    }
}
