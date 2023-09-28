// SPDX-License-Identifier: MIT

pragma solidity =0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IToken.sol";

contract Token is IToken, ERC20Pausable, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000 * 1e18;
    uint256 public constant BURN_FEE_PRECISION = 10000; // used as ratio. for 0.5% burn fee = 0.005 in ratio. So, 50 / precision = 0.005

    mapping(address => bool) public isFrozenWallet; // checks if wallet is frozen
    mapping(address => bool) public isWhitelistedWallet; // check if wallet is whitelisted, no burn fees

    uint256 public burnFeesRatio; // deducted while making transfers, not for whitelisted wallet
    uint256 public minBurnFeeLimit; // min limit of total supply for burn fee deduction

    constructor(string memory _name, string memory _symbol, address _owner) ERC20(_name, _symbol) {
        burnFeesRatio = 50;
        uint256 decimalAmount = 10 ** decimals();
        minBurnFeeLimit = 10000 * decimalAmount;
        _mint(_owner, 200000 * decimalAmount);
        _transferOwnership(_owner);
    }

    function freezeWallet(address _account, bool isFreeze) external onlyOwner() {
        isFrozenWallet[_account] = isFreeze;
        emit WalletFroze(_account, isFreeze);
    }

    function whitelistWallet(address _account, bool isWhitelist) external onlyOwner() {
        isWhitelistedWallet[_account] = isWhitelist;
        emit WalletWhitelisted(_account, isWhitelist);
    }

    function togglePause() external onlyOwner() {
        paused() ? _unpause() : _pause();
    }

    function mint(address _account, uint256 _amount) external onlyOwner() {
        require(totalSupply() + _amount <= MAX_SUPPLY, "Token: exploit max supply");
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external onlyOwner() {
        _burn(_account, _amount);
    }

    function transfer(address _to, uint256 _amount) public override returns (bool) {
        _requireNotFrozen(msg.sender);
        _amount = _burnTransferFees(msg.sender, _amount);
        return super.transfer(_to, _amount);
    }

    function transferFrom(address _from, address _to, uint256 _amount) public override returns (bool) {
        _requireNotFrozen(_from);
        _amount = _burnTransferFees(_from, _amount);
        return super.transferFrom(_from, _to, _amount);
    }

    function batchTransfer(address[] calldata _accounts, uint256[] memory _amounts) external {
        _requireNotFrozen(msg.sender);
        uint256 totalAccounts = _accounts.length;
        require(totalAccounts == _amounts.length, "Token: invalid array length");
        for (uint256 index; index < totalAccounts; ++index) {
            super.transfer(_accounts[index], _burnTransferFees(msg.sender, _amounts[index]));
        }
    }

    function _burnTransferFees(address _account, uint256 _amount) internal returns(uint256 remaningAmount) {
        if (isWhitelistedWallet[_account]) return _amount;

        remaningAmount = _amount;
        if (totalSupply() > minBurnFeeLimit) {
            uint256 burnFeeAmount = (_amount * burnFeesRatio) / BURN_FEE_PRECISION;
            remaningAmount = _amount - burnFeeAmount;
            _burn(_account, burnFeeAmount);
        }
    }

    function _requireNotFrozen(address _account) internal view {
        require(!isFrozenWallet[_account], "Token: frozen wallet");
    }
}
