const { time } = require('@openzeppelin/test-helpers');
const { expect } = require("chai")
const { ethers } = require("hardhat")
const { BigNumber } = require("ethers");

require('dotenv').config();

const {
} = process.env;

const ZERO = BigNumber.from(0);
const ONE = BigNumber.from(1);
const TWO = BigNumber.from(2);
const ONE_TOKEN = BigNumber.from(10).pow(18);


describe("CrowdSale", function () {
  let staking;

  let token1;
  let token2;

  let alice;
  let bob;
  let dev;
  let minter;

  let lvl1;
  let lvl2;
  let lvl3;
  let lvl4;
  let lvl5;

  beforeEach(async function () {
    [alice, dev2, dev, minter] = await ethers.getSigners()
    const Token = await ethers.getContractFactory("MockERC20", minter)
    const Staking = await ethers.getContractFactory("Staking", dev)
    const CrowdSale = await ethers.getContractFactory("CrowdSale", dev2)

    token1 = await Token.deploy('Token', 'TK1', ONE_TOKEN.mul(1000))
    token2 = await Token.deploy('Token', 'TK2', ONE_TOKEN.mul(1000))
    tokenPayment = await Token.deploy('TokenP', 'TKP', ONE_TOKEN.mul(10000))
    tokenSale = await Token.deploy('TokenS', 'TKS', ONE_TOKEN.mul(1000))

    await token1.connect(minter).deployed()
    await token2.connect(minter).deployed()
    await tokenPayment.connect(minter).deployed()
    await tokenSale.connect(minter).deployed()

    staking = await Staking.deploy(token1.address, token2.address)
    await staking.connect(dev).deployed()

    crowdsale = await CrowdSale.deploy(
      tokenPayment.address,
      tokenSale.address,
      staking,
      10,
      60 * 60 * 24 * 30,
      ONE_TOKEN.mul(100),
      30
    )
    await crowdsale.connect(dev2).deployed()

    // Пополняем кошельки

    await token2.connect(minter).transfer(staking.address, ONE_TOKEN.mul(10))
    await token1.connect(minter).transfer(alice.address, ONE_TOKEN.mul(100))
    await tokenSale.connect(minter).transfer(crowdsale.address, ONE_TOKEN.mul(130))
    await tokenPayment.connect(minter).transfer(alice.address, ONE_TOKEN.mul(2000))

    // Заполняем уровни для стейкинга

    lvl1 = await staking.connect(dev).makeLevelInfo(ONE_TOKEN.mul(1), 5)
    lvl2 = await staking.connect(dev).makeLevelInfo(ONE_TOKEN.mul(3), 7)
    lvl3 = await staking.connect(dev).makeLevelInfo(ONE_TOKEN.mul(5), 9)
    lvl4 = await staking.connect(dev).makeLevelInfo(ONE_TOKEN.mul(7), 11)
    lvl5 = await staking.connect(dev).makeLevelInfo(ONE_TOKEN.mul(10), 15)

    await staking.connect(dev).setLevelInf([lvl1, lvl2, lvl3, lvl4, lvl5])

    // Делаем стейкинг

    await token1.connect(alice).approve(staking.address, ONE_TOKEN.mul(100));
    await staking.connect(alice).deposit(ONE_TOKEN.mul(3));
    await staking.connect(alice).withdraw('0')
    // Проверка что уровень Алисы - 2й
    expect(await staking.getLevelInfo(alice.address)).to.be.eq(TWO)

  })

  it("Should be deployed", async function () {
    expect(crowdsale.address).to.be.properAddress
  })

  it("Buy", async function () {
    crowdsale.connect(alice).buy(ONE_TOKEN.mul(50))
    expect(await tokenPayment.balanceOf(crowdsale.address)).to.be.eq(ONE_TOKEN.mul(50))
    await time.increase(60 * 60 * 24 * 31); // Спустя 31 день
    await crowdsale.connect(dev2).finalize(); // После закрытия сейла добавляем ликвидность
    await time.increase(60 * 60 * 24 * 2); // Спустя 2 дня пользователь вспоминает, что можно уже забрать награду
    await crowdsale.connect(alice).getTokens()
    expect(await tokenSale.balanceOf(alice.address)).to.be.eq(ONE_TOKEN.mul(5)) // А мы точно 5 токенов получили?
    await crowdsale.connect(dev2).withdrawAll()
    expect(await tokenSale.balanceOf(dev2.address)).to.be.eq(ONE_TOKEN.mul(95)) // А остальные 95 не проданы и венулись владельцу?
  })
}) 