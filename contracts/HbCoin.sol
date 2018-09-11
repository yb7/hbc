pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Capped.sol";

contract HbCoin is ERC20, ERC20Detailed, ERC20Capped {
    constructor(
        string name,
        string symbol,
        uint8 decimals,
        uint256 cap
    ) ERC20Capped(cap)
      ERC20Mintable() // owner is the only minter
      ERC20Detailed(name, symbol, decimals)
      ERC20() public {
    }
}
