// SPDX-License-Identifier: MIT

pragma solidity =0.8.19;

interface IToken {
    event WalletFroze(address indexed account, bool isFrozen);
    event WalletWhitelisted(address indexed account, bool isWhitelisted);

    function isFrozenWallet(address _account) external view returns (bool);
    function isWhitelistedWallet(address _account) external view returns (bool);
    function burnFeesRatio() external view returns (uint256);
    function minBurnFeeLimit() external view returns (uint256);
    function batchTransfer(address[] calldata _accounts, uint256[] memory _amounts) external;

    function mint(address _account, uint256 _amount) external;
    function burn(address _account, uint256 _amount) external;
    function whitelistWallet(address _account, bool isWhitelist) external;
    function freezeWallet(address _account, bool isFreeze) external;
    function togglePause() external;
}
