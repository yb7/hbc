pragma solidity ^0.4.23;

import "./HbCoin.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/drafts/TokenVesting.sol";

contract HbCoinCrowdsale is AllowanceCrowdsale, FinalizableCrowdsale {

    using SafeMath for uint256;

    address[] private _balanceAccounts;
    mapping(address => uint256) private _balances;
    mapping(address => TokenVesting) private _tokenVestings;
    uint private _finishAt;
    uint private _vestCliffDuration;
    uint private _vestDuration;

    constructor(
        uint256 openingTime,
        uint256 closingTime,
        uint256 _rate,
        address _wallet,
        IERC20 _token,
        address tokenWallet,
        uint vestCliffDuration,
        uint vestDuration
    )
    Crowdsale(_rate, _wallet, _token)
    AllowanceCrowdsale(tokenWallet)
    TimedCrowdsale(openingTime, closingTime)
    public
    {
        _vestCliffDuration = vestCliffDuration;
        _vestDuration = vestDuration;
    }

    /**
    * @return the balance of an account.
    */
    function balanceOf(address account) public view returns(uint256) {
        return _balances[account];
    }

    function finishAt() public view returns(uint) {
        return _finishAt;
    }

    function vestCliffDuration() public view returns(uint) {
        return _vestCliffDuration;
    }
    function vestDuration() public view returns(uint) {
        return _vestDuration;
    }
    function vestingContract(address beneficiary) public view returns(TokenVesting) {
        return _tokenVestings[beneficiary];
    }


    /**
     * @dev Overrides parent by storing balances instead of issuing tokens right away.
     * @param beneficiary Token purchaser
     * @param tokenAmount Amount of tokens purchased
     */
    function _processPurchase(
        address beneficiary,
        uint256 tokenAmount
    )
      internal
    {
        if (_balances[beneficiary] == 0) {
            _balanceAccounts.push(beneficiary);
        }
        _balances[beneficiary] = _balances[beneficiary].add(tokenAmount);
    }

    function _finalization() internal {
        super._finalization();
        // solium-disable-next-line security/no-block-members
        _finishAt = block.timestamp;
        for (uint i = 0; i < _balanceAccounts.length; i++) {
            address beneficiary = _balanceAccounts[i];
            uint256 amount = balanceOf(beneficiary);
            TokenVesting vesting = new TokenVesting(
                beneficiary, _finishAt, _vestCliffDuration, _vestDuration, false
            );
            _deliverTokens(vesting, amount);
            _tokenVestings[beneficiary] = vesting;
        }
    }
}
