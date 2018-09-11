
const HbCoinCrowdsale = artifacts.require('./HbCoinCrowdsale.sol');
const HbCoin = artifacts.require('./HbCoin.sol');

function ether (n) {
  return new web3.BigNumber(web3.toWei(n, 'ether'));
}


module.exports = function(deployer, network, accounts) {
    const openingTime = web3.eth.getBlock('latest').timestamp + 2; // two secs in the future
    // const closingTime = openingTime + 86400 * 20; // 20 days
    const vestCliffDuration = 86400 * 365;
    const vestDuration = vestCliffDuration * 2;
    const rate = new web3.BigNumber(1000);
    const wallet = accounts[1];
    const allowanceTokenWallet = accounts[2];

    return deployer
        .then(() => {
            return deployer.deploy(HbCoin,
              "HighBei Coin",
              "HBC",
              18,
              ether(100000),
            );
        })
        .then(() => {
            return deployer.deploy(
                HbCoinCrowdsale,
                rate,
                wallet,
                HbCoin.address,
                allowanceTokenWallet,
                vestCliffDuration,
                vestDuration,
            );
        });
};
