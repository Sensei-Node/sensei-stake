pragma solidity ^0.8.0;

interface ISenseistakeMetadata {
    function getMetadata(
        string calldata tokenId_,
        string calldata createdAt_,
        string calldata commissionRate_,
        bytes calldata validatorPubKey_,
        uint256 exitedAt_
    ) external pure returns (string memory);
}
