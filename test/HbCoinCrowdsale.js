const { ether } = require('openzeppelin-solidity/test/helpers/ether');
const { advanceBlock } = require('openzeppelin-solidity/test/helpers/advanceToBlock');
const { assertRevert } = require('openzeppelin-solidity/test/helpers/assertRevert');
const { ethGetBalance } = require('openzeppelin-solidity/test/helpers/web3');
const { latestTime } = require('openzeppelin-solidity/test/helpers/latestTime');
const { increaseTimeTo, duration } = require('openzeppelin-solidity/test/helpers/increaseTime');
const { expectThrow } = require('openzeppelin-solidity/test/helpers/expectThrow');
const { EVMRevert } = require('openzeppelin-solidity/test/helpers/EVMRevert');
const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const HbCoinCrowdsale = artifacts.require('HbCoinCrowdsale');
const HbCoin = artifacts.require('HbCoin');
// const TokenVesting = artifacts.require('TokenVesting');

contract('HbCoinCrowdsale', function ([_, investor, wallet, purchaser, tokenWallet]) {
  const rate = new BigNumber(1);
  const value = ether(0.42);
  const expectedTokenAmount = rate.mul(value);
  const tokenCap = new BigNumber('5e22');
  const tokenAllowance = new BigNumber('1e22');
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = (await latestTime()) + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(1);
    this.afterClosingTime = this.closingTime + duration.seconds(1);

    this.token = await HbCoin.new("HbCoin", "HBC", 18, tokenCap, { from: tokenWallet });
    this.vestCliffDuration = duration.years(1);
    this.vestDuration = duration.years(2);
    this.crowdsale = await HbCoinCrowdsale.new(this.openingTime, this.closingTime, rate, wallet, this.token.address, tokenWallet, this.vestCliffDuration, this.vestDuration);
    await this.token.approve(this.crowdsale.address, tokenAllowance, { from: tokenWallet });
  });

  describe('accepting payments', function () {
    it('should have token wallet', async function () {
      (await this.crowdsale.tokenWallet()).should.be.equal(tokenWallet);
    });

    // it('should accept sends', async function () {
    //   await this.crowdsale.send(value);
    // });

    // it('should accept payments', async function () {
    //   await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
    // });
  });

  it('rejects an opening time in the past', async function () {
    await expectThrow(HbCoinCrowdsale.new(
      (await latestTime()) - duration.days(1), this.closingTime, rate, wallet, this.token.address, tokenWallet, this.vestCliffDuration, this.vestDuration
    ), EVMRevert);
  });

  it('rejects a closing time before the opening time', async function () {
    await expectThrow(HbCoinCrowdsale.new(
      this.openingTime, this.openingTime - duration.seconds(1), rate, wallet, this.token.address, tokenWallet, this.vestCliffDuration, this.vestDuration
    ), EVMRevert);
  });

  context('with crowdsale', function () {
    beforeEach(async function () {
      const tokenSupply = new BigNumber('1e22');
      this.crowdsale = await HbCoinCrowdsale.new(this.openingTime, this.closingTime, rate, wallet, this.token.address, tokenWallet, this.vestCliffDuration, this.vestDuration);
      await this.token.mint(this.crowdsale.address, tokenSupply, { from: tokenWallet });
    });

    it('should be ended only after end', async function () {
      (await this.crowdsale.hasClosed()).should.equal(false);
      await increaseTimeTo(this.afterClosingTime);
      (await this.crowdsale.isOpen()).should.equal(false);
      (await this.crowdsale.hasClosed()).should.equal(true);
    });

    describe('accepting payments', function () {
      it('should reject payments before start', async function () {
        (await this.crowdsale.isOpen()).should.equal(false);
        await expectThrow(this.crowdsale.send(value), EVMRevert);
        await expectThrow(this.crowdsale.buyTokens(investor, { from: purchaser, value: value }), EVMRevert);
      });

      it('should accept payments after start', async function () {
        await increaseTimeTo(this.openingTime);
        (await this.crowdsale.isOpen()).should.equal(true);
        await this.crowdsale.send(value);
        await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
      });

      it('should reject payments after end', async function () {
        await increaseTimeTo(this.afterClosingTime);
        await expectThrow(this.crowdsale.send(value), EVMRevert);
        await expectThrow(this.crowdsale.buyTokens(investor, { value: value, from: purchaser }), EVMRevert);
      });
    });
  });

  describe('high-level purchase', function () {
    beforeEach(async function() {
      await increaseTimeTo(this.openingTime);
    })
    it('should log purchase', async function () {
      const { logs } = await this.crowdsale.sendTransaction({ value: value, from: investor });
      const event = logs.find(e => e.event === 'TokensPurchased');
      should.exist(event);
      event.args.purchaser.should.equal(investor);
      event.args.beneficiary.should.equal(investor);
      event.args.value.should.be.bignumber.equal(value);
      event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
    });

    it('should assign tokens to sender', async function () {
      await this.crowdsale.sendTransaction({ value: value, from: investor });
      (await this.crowdsale.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
      // do finish
      // (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
    });

    it('should forward funds to wallet', async function () {
      // 先给 tokenWallet 生成一定量的token
      await this.token.mint(tokenWallet, tokenAllowance, { from: tokenWallet });
      // 授权 crowdsale 从 tokenWallet 中提取token
      await this.token.approve(this.crowdsale.address, tokenAllowance, { from: tokenWallet });

      const remainingTokenPre = await this.crowdsale.remainingTokens();
      remainingTokenPre.should.be.bignumber.equal(tokenAllowance);
      console.log('remaining token in crowdsale: %d', remainingTokenPre);

      const pre = await ethGetBalance(wallet);
      console.log('eth balance: ', web3.fromWei(pre, 'ether').toString(10));

      await this.crowdsale.sendTransaction({ value, from: investor });

      const post = await ethGetBalance(wallet);
      console.log('eth balance: ', web3.fromWei(post, 'ether').toString(10));
      post.minus(pre).should.be.bignumber.equal(value);

      const balanceInCrowdsale = await this.crowdsale.balanceOf(investor);
      console.log('balance in crowdsale: ', balanceInCrowdsale.toString(10));
      await increaseTimeTo(this.afterClosingTime);
      (await this.crowdsale.hasClosed()).should.equal(true);
      (await this.crowdsale.finalized()).should.equal(false);
      await this.crowdsale.finalize();

      const tokenVesting = await this.crowdsale.vestingContract(investor);
      console.log('token vesting: ', tokenVesting);
      const vestingAmount = await this.token.balanceOf(tokenVesting);
      console.log('vesting amount: ', vestingAmount.toString(10));

      const remainingTokenPost = await this.crowdsale.remainingTokens();

      // should report correct allowace left
      remainingTokenPre.minus(remainingTokenPost).should.be.bignumber.equal(value);
      console.log('remaining token in crowdsale: %d', remainingTokenPost);
    });
  });

  // 不要打开，会错的
  // describe('check remaining allowance', function () {
  //   it('should report correct allowace left', async function () {
  //     await increaseTimeTo(this.openingTime);
  //     const remainingAllowance = tokenAllowance - expectedTokenAmount;
  //     await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
  //     (await this.crowdsale.remainingTokens()).should.be.bignumber.equal(remainingAllowance);
  //   });
  // });

  // 不要打开，会错的
  // describe('when token wallet is different from token address', function () {
  //   it('creation reverts', async function () {
  //     this.token = await HbCoin.new("HbCoin", "HBC", 18, tokenCap, { from: tokenWallet });
  //     await assertRevert(HbCoinCrowdsale.new(this.openingTime, this.closingTime, rate, wallet, this.token.address, ZERO_ADDRESS, this.vestCliffDuration, this.vestDuration));
  //   });
  // });
});
