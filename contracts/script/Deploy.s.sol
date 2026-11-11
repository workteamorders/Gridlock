// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Script, console} from "forge-std/Script.sol";
import {GridlockCars} from "../src/GridlockCars.sol";
import {GridlockRenderer} from "../src/GridlockRenderer.sol";

/// @notice Deploys GridlockRenderer then GridlockCars from a JSON config in deploy/.
/// @dev This script is run MANUALLY by the owner with a Foundry keystore or a hardware wallet:
///        DEPLOY_CONFIG=deploy/testnet.json forge script script/Deploy.s.sol --account <keystore> --sender <addr> --rpc-url <url>            (simulation only)
///        DEPLOY_CONFIG=deploy/testnet.json forge script script/Deploy.s.sol --ledger --sender <addr> --rpc-url <url> --broadcast         (sends transactions)
///      The agent that wrote this script never holds keys and never broadcasts. It is tested only against a local node.
///      No private key is read here. Signing comes from --account or --ledger.
contract Deploy is Script {
    uint256 internal constant ROBINHOOD_MAINNET = 4663;

    function run() external returns (GridlockRenderer renderer, GridlockCars cars) {
        string memory json = vm.readFile(vm.envString("DEPLOY_CONFIG"));

        if (block.chainid == ROBINHOOD_MAINNET) {
            // Mainnet is permanent. The contract must not go there before an external audit and an explicit owner decision.
            require(
                keccak256(bytes(vm.envOr("CONFIRM_MAINNET", string("")))) == keccak256("I-HAVE-AN-EXTERNAL-AUDIT-AND-I-DECIDE"),
                "mainnet needs CONFIRM_MAINNET (external audit and owner decision)"
            );
        }

        GridlockCars.Params memory p;
        p.treasury = vm.parseJsonAddress(json, ".treasury");
        uint256 start = vm.parseJsonUint(json, ".startTime");
        if (start == 0) {
            // Local testing only: start shortly after the current block.
            require(block.chainid == 31337, "startTime 0 is allowed only on a local node");
            start = block.timestamp + vm.parseJsonUint(json, ".startOffsetSeconds");
        }
        p.startTime = uint64(start);
        p.openTimeout = uint64(vm.parseJsonUint(json, ".openTimeoutSeconds"));
        p.heatDecaySeconds = uint64(vm.parseJsonUint(json, ".heatDecaySeconds"));
        p.revealMinDelay = uint64(vm.parseJsonUint(json, ".revealMinDelaySeconds"));

        uint256[] memory capList = vm.parseJsonUintArray(json, ".caps");
        string[] memory priceList = vm.parseJsonStringArray(json, ".pricesWei");
        bytes32[] memory huntList = vm.parseJsonBytes32Array(json, ".huntCommitments");
        require(capList.length == 15 && priceList.length == 15 && huntList.length == 12, "bad config lengths");
        for (uint256 i; i < 15; ++i) {
            p.caps[i] = uint16(capList[i]);
            p.prices[i] = vm.parseUint(priceList[i]);
        }
        for (uint256 i; i < 12; ++i) {
            p.huntCommitments[i] = huntList[i];
        }

        vm.startBroadcast();
        renderer = new GridlockRenderer();
        p.renderer = address(renderer);
        cars = new GridlockCars(p);
        vm.stopBroadcast();

        console.log("chainId", block.chainid);
        console.log("GridlockRenderer", address(renderer));
        console.log("GridlockCars", address(cars));
        console.log("startTime", p.startTime);

        if (vm.envOr("WRITE_DEPLOYMENT", false)) {
            string memory k = "deployment";
            vm.serializeUint(k, "chainId", block.chainid);
            vm.serializeAddress(k, "renderer", address(renderer));
            string memory out = vm.serializeAddress(k, "cars", address(cars));
            vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));
        }
    }
}
