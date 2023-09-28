import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { Token__factory, Token } from "../typechain-types";

/**
 * <-- Cases -->
  Token
    ✔ Should deploy token
    Getters
      ✔ Should fetch MAX_SUPPLY = 1000000 * 1e18
      ✔ Should check total supply = 1M * 1e18
      ✔ Should check owner is supplied address
    Requirements
      ✔ Should only mint when owner called
      ✔ Should freeze wallet
      ✔ Should revert when contract is paused
      ✔ Should burn when owner called
      ✔ Should not mint more than max supply
      Batch Transfers
        ✔ Should revert for invalid array length
        ✔ Should transfer to alice and bob
      Transfer tax
        ✔ Should deduct tax
        ✔ Should not deduct tax of whitelist wallet
        ✔ Should deduct tax when totalSupply < 1M
 */

describe("Token", () => {
  let owner: any, alice: any, bob: any;
  let contract: Token__factory;
  let instance: Token;
  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    contract = await ethers.getContractFactory("Token");
  });

  beforeEach(async () => {
    instance = await contract.deploy(
      `${process.env.TOKEN_NAME}`,
      `${process.env.TOKEN_SYMBOL}`,
      process.env.OWNER ? `${process.env.OWNER}` : owner.address
    );
    await instance.deployed();
  });

  it("Should deploy token", async () => {
    const receipt = await instance.deployed();
    expect(receipt.deployTransaction.confirmations).not.equal(0);
  });

  describe("Getters", () => {
    it("Should fetch MAX_SUPPLY = 1000000 * 1e18", async () => {
      const maxSupply = await instance.MAX_SUPPLY();
      expect(maxSupply.toString()).equal("1000000000000000000000000");
    });

    it("Should check total supply = 1M * 1e18", async () => {
      const currentSupply = await instance.totalSupply();
      expect(currentSupply.toString()).equal("200000000000000000000000");
    });

    it("Should check owner is supplied address", async () => {
      const tokenOwner = await instance.owner();
      expect(tokenOwner).equal(owner.address);
    });
  });

  describe("Requirements", () => {
    /**
     * Mint function
     * Freeze function for freezing wallet assets
     * Pausable function for pausing the contract functions
     * Burn fn
     * Transfer tax - 0.5% burn
     * whitelisted address will be there - no burn tax
     * When the total supply reaches 10k no burn tax should be applied.
     */
    it("Should only mint when owner called", async () => {
      const bobBalance = await instance.balanceOf(bob.address);
      await (
        await instance.connect(owner).mint(bob.address, convertTo18("1000"))
      ).wait();
      const bobBalanceAfter = await instance.balanceOf(bob.address);
      expect(bobBalanceAfter.sub(bobBalance).toString()).equal(
        convertTo18("1000").toString()
      );
    });

    it("Should freeze wallet", async () => {
      await (await instance.freezeWallet(bob.address, true)).wait();
      await expect(
        instance.connect(bob).transfer(alice.address, convertTo18("1000"))
      ).to.revertedWith("Token: frozen wallet");
    });

    it("Should revert when contract is paused", async () => {
      await (await instance.togglePause()).wait();
      await expect(
        instance.transfer(bob.address, convertTo18("1000"))
      ).to.revertedWith("ERC20Pausable: token transfer while paused");
    });

    it("Should burn when owner called", async () => {
      await (
        await instance.connect(owner).mint(bob.address, convertTo18("1"))
      ).wait();
      const bobBalance = await instance.balanceOf(bob.address);
      await (
        await instance.connect(owner).burn(bob.address, convertTo18("1"))
      ).wait();
      const bobBalanceAfter = await instance.balanceOf(bob.address);
      expect(bobBalance.sub(bobBalanceAfter).toString()).equal(
        convertTo18("1").toString()
      );
    });

    it("Should not mint more than max supply", async () => {
      await expect(
        instance.mint(bob.address, convertTo18("800001"))
      ).revertedWith("Token: exploit max supply");
    });

    describe("Batch Transfers", async () => {
      it("Should revert for invalid array length", async () => {
        await expect(
          instance.batchTransfer(
            [bob.address, alice.address],
            [convertTo18("10"), convertTo18("20"), convertTo18("30")]
          )
        ).revertedWith("Token: invalid array length");
      });

      it("Should transfer to alice and bob", async () => {
        await (await instance.whitelistWallet(owner.address, true)).wait();
        const balanceBefore = {
          alice: await instance.balanceOf(alice.address),
          bob: await instance.balanceOf(bob.address),
        };
        await (
          await instance.batchTransfer(
            [alice.address, bob.address],
            [convertTo18("100"), convertTo18("200")]
          )
        ).wait();
        const balanceAfter = {
          alice: await instance.balanceOf(alice.address),
          bob: await instance.balanceOf(bob.address),
        };
        expect(balanceAfter.alice.sub(balanceBefore.alice)).equal(
          convertTo18("100")
        );
        expect(balanceAfter.bob.sub(balanceBefore.bob)).equal(
          convertTo18("200")
        );
      });
    });

    describe("Transfer tax", () => {
      it("Should deduct tax", async () => {
        await (await instance.transfer(bob.address, convertTo18("1"))).wait();
        const bobBalance = await instance.balanceOf(bob.address);
        const burnFeeRatio = await instance.burnFeesRatio();
        const transferFees = convertTo18("1")
          .mul(burnFeeRatio)
          .div(BigNumber.from("10000"));
        expect(bobBalance.add(transferFees)).equal(convertTo18("1"));
      });

      it("Should not deduct tax of whitelist wallet", async () => {
        await (await instance.whitelistWallet(owner.address, true)).wait();
        const bobBalance = await instance.balanceOf(bob.address);
        await (await instance.transfer(bob.address, convertTo18("1"))).wait();
        const bobBalanceAfter = await instance.balanceOf(bob.address);
        expect(bobBalanceAfter.sub(bobBalance)).equal(convertTo18("1"));
      });

      it("Should deduct tax when totalSupply < 1M", async () => {
        await (
          await instance.burn(owner.address, convertTo18("199000"))
        ).wait();
        const bobBalance = await instance.balanceOf(bob.address);
        await (
          await instance.transfer(bob.address, convertTo18("1000"))
        ).wait();
        const bobBalanceAfter = await instance.balanceOf(bob.address);
        expect(bobBalanceAfter.sub(bobBalance)).equal(convertTo18("1000"));
      });
    });
  });
});

const convertTo18 = (value: string): BigNumber => {
  return ethers.utils.parseEther(value);
};
