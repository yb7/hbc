const HbCoin = artifacts.require('HbCoin');
const { assertRevert } = require('openzeppelin-solidity/test/helpers/assertRevert');
const { ether } = require('openzeppelin-solidity/test/helpers/ether');
const { shouldBehaveLikeERC20Mintable } = require('openzeppelin-solidity/test/token/ERC20/behaviors/ERC20Mintable.behavior');
const { shouldBehaveLikeERC20Capped } = require('openzeppelin-solidity/test/token/ERC20/behaviors/ERC20Capped.behavior');
const { latestTime } = require('openzeppelin-solidity/test/helpers/latestTime');
const { increaseTimeTo, duration } = require('openzeppelin-solidity/test/helpers/increaseTime');

contract('HbCoin', function ([_, minter, ...otherAccounts]) {
  const cap = ether(100);
  it('requires a non-zero cap', async function() {
    await assertRevert(
      HbCoin.new("HbCoin", "HBC", 18, 0, { from: minter })
    )
  })

  context('once deployed', async function() {
    beforeEach(async function () {
      this.token = await HbCoin.new("HbCoin", "HBC", 18, cap, { from: minter })
    });

    shouldBehaveLikeERC20Capped(minter, otherAccounts, cap);
    shouldBehaveLikeERC20Mintable(minter, otherAccounts);
  })
})
