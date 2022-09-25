const { ethers, deployments, getNamedAccounts, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Unit tests", () => {
      let nftMarketplace, basicNft, deployer, player;
      const PRICE = ethers.utils.parseEther("0.1");
      const TOKEN_ID = 0;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        //player = (await getNamedAccounts()).player;
        player = (await ethers.getSigners())[1];
        await deployments.fixture(["all"]);

        nftMarketplace = await ethers.getContract("NftMarketplace");
        basicNft = await ethers.getContract("BasicNft");

        await basicNft.mintNft();
        await basicNft.approve(nftMarketplace.address, TOKEN_ID);
      });

      it("lists and can be bought", async () => {
        const tx = await nftMarketplace.listItem(
          basicNft.address,
          TOKEN_ID,
          PRICE
        );
        // player will buy the nft
        const playerConnectedNftMarketplace = nftMarketplace.connect(player);
        // lets buy
        const tx_buy = await playerConnectedNftMarketplace.buyItem(
          basicNft.address,
          TOKEN_ID,
          { value: PRICE }
        );
        const newOwner = await basicNft.ownerOf(TOKEN_ID);
        const deployerProceeds = await nftMarketplace.getProceeds(deployer);
        assert(newOwner.toString() == player.address);
        assert(deployerProceeds.toString() == PRICE.toString());
        expect(tx).to.emit(nftMarketplace, "ItemListed");
        expect(tx_buy).to.emit(nftMarketplace, "ItemBought");
      });

      it("Item can be canceled listing", async () => {
        const tx = await nftMarketplace.listItem(
          basicNft.address,
          TOKEN_ID,
          PRICE
        );
        const tx_cancel = await nftMarketplace.cancelListing(
          basicNft.address,
          TOKEN_ID
        );
        expect(tx_cancel).to.emit(nftMarketplace, "ItemCanceled");
        const listing = await nftMarketplace.getListing(
          basicNft.address,
          TOKEN_ID
        );
        assert(listing.price.toString() == "0");
      });

      it("Items can be uptaded", async () => {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        const NEW_PRICE = ethers.utils.parseEther("0.2");
        const tx = await nftMarketplace.uptadeListing(
          basicNft.address,
          TOKEN_ID,
          NEW_PRICE
        );
        await tx.wait(1);
        const checkNewPrice = await nftMarketplace.getListing(
          basicNft.address,
          TOKEN_ID
        );
        assert(checkNewPrice.price.toString() == NEW_PRICE.toString());
        expect(tx).to.emit(nftMarketplace, "ItemListed");
      });
      it("receive proceeds", async () => {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        const playerConnectedNftMarketplace = nftMarketplace.connect(player);
        const tx_buy = await playerConnectedNftMarketplace.buyItem(
          basicNft.address,
          TOKEN_ID,
          { value: PRICE }
        );
        await tx_buy.wait(1);
        //const playerProceeds = await nftMarketplace.getProceeds(player.address);
        // console.log(playerProceeds.toString());
        await expect(
          playerConnectedNftMarketplace.withdrawProceeds()
        ).to.be.revertedWith("NftMarketplace__NoProceeds");
      });
    });
