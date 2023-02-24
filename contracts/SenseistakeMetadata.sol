// SPDX-License-Identifier: MIT
pragma solidity >=0.8.17;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract SenseistakeMetadata {
    /// @notice for checking that contract implements selector function
    /// @return getMetadata selector
    function isValid(bytes4 selector_) external pure returns (bytes4) {
        return selector_ == this.getMetadata.selector;
    }

    /// @notice for getting the metadata in base64 format for Senseistake NFT
    /// @param tokenId_ of the NFT
    /// @param createdAt_ NFT minted date
    /// @param commissionRate_ commission rate used for service
    /// @param validatorPubKey_ validator public key
    /// @param exitedAt_ validator exited date
    /// @return string base64 encoded metadata
    function getMetadata(
        string calldata tokenId_,
        string calldata createdAt_,
        string calldata commissionRate_,
        bytes calldata validatorPubKey_,
        uint256 exitedAt_
    ) external pure returns (string memory) {
        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(
                    bytes(
                        abi.encodePacked(
                            exitedAt_ != 0 ? '{"name":"[EXITED] ETH Validator #' : '{"name":"ETH Validator #',
                            tokenId_,
                            '","description":"Sensei Stake is a non-custodial staking platform for Ethereum 2.0, that uses a top-performance node infrastructure provided by Sensei Node. Each NFT of this collection certifies the ownership receipt for one active ETH2 Validator and its accrued proceeds from protocol issuance and transaction processing fees. These nodes are distributed across the Latin American region, on local or regional hosting service providers, outside centralized global cloud vendors. Together we are fostering decentralization and strengthening the Ethereum ecosystem. One node at a time. Decentralization matters.",',
                            '"external_url":"https://dashboard.senseinode.com/redirsenseistake?v=',
                            _bytesToHexString(validatorPubKey_),
                            '","minted_at":',
                            createdAt_,
                            ',"image":"',
                            "ipfs://bafybeifgh6572j2e6ioxrrtyxamzciadd7anmnpyxq4b33wafqhpnncg7m",
                            '","attributes": [{"trait_type": "Validator Address","value":"',
                            _bytesToHexString(validatorPubKey_),
                            '"},{',
                            exitedAt_ != 0 ? '"trait_type":"Exited At","display_type":"string","value":"' : "",
                            exitedAt_ != 0 ? Strings.toString(exitedAt_) : "",
                            exitedAt_ != 0 ? '"},{' : "",
                            '"trait_type": "Commission Rate","display_type":"string","value":"',
                            commissionRate_,
                            '%"}]}'
                        )
                    )
                )
            )
        );
    }

    /// @notice Helper function for converting bytes to hex string
    /// @param buffer_ bytes data to convert
    /// @return string converted buffer
    function _bytesToHexString(bytes memory buffer_) internal pure returns (string memory) {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer_.length * 2);
        bytes memory _base = "0123456789abcdef";
        for (uint256 i = 0; i < buffer_.length;) {
            converted[i * 2] = _base[uint8(buffer_[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer_[i]) % _base.length];
            unchecked {
                ++i;
            }
        }
        return string(abi.encodePacked("0x", converted));
    }
}
