import { expect } from 'chai';
import hre from "hardhat";
import { ethers } from 'ethers';
import { EnergyStorage } from '../typechain-types/contracts/EnergyStorage';

describe('Trading', async () => {

    const gridName = 'Helsingborg';
    const countryCode = 'SE';
    const country = 'Sweden';
    const gridId = ethers.solidityPackedKeccak256(['string', 'string'], [gridName, countryCode]);

    async function deployContractFixture() {
        const [owner, seller, buyer] = await hre.ethers.getSigners();

        // Deploy EnergyStorage contract
        // const EnergyStorageMock = await hre.ethers.getContractFactory("contracts/EnergyStorage.sol:EnergyStorage");
        // const energyStorage = await EnergyStorageMock.deploy();
        const EnergyStorageMock = await hre.ethers.getContractFactory("contracts/EnergyStorage.sol:EnergyStorage");
        const energyStorage = await EnergyStorageMock.deploy() as EnergyStorage;
        await energyStorage.waitForDeployment();

        const Trading = await hre.ethers.getContractFactory("Trading");
        const trading = await Trading.deploy();
        await trading.waitForDeployment();

        await trading.connect(owner).setEnergyStorageContract(energyStorage.getAddress());
        await energyStorage.connect(owner).setTradingContract(trading.getAddress());

        return { trading, energyStorage, owner, seller, buyer };
    }

    describe('Contract deployment', async () => {

        it('should deploy the contract successfully', async () => {
            const { trading } = await deployContractFixture();
            const contractAddress = await trading.getAddress();
            expect(contractAddress).to.be.a("string");
            expect(contractAddress).to.not.equal("0x0000000000000000000000000000000000000000");
            expect(contractAddress).to.be.properAddress;
        });

    });

    describe('setEnergyStorageContract', async () => {
        it('should revert to UnauthorizedAccess', async () => {
            const { trading, energyStorage, seller } = await deployContractFixture();
            await expect(trading.connect(seller).setEnergyStorageContract(energyStorage.getAddress())).to.be.revertedWithCustomError(trading, 'UnauthorizedAccess');
        });

        it('should emit EnergyStorageContractSet once successfull', async () => {
            const { trading, energyStorage, owner } = await deployContractFixture();
            await expect(trading.connect(owner).setEnergyStorageContract(energyStorage.getAddress())).to.emit(trading, 'EnergyStorageContractSet');
        });
    });

    describe('createTrade', async () => {

        it('should create a trade successfully', async () => {

            const { trading, energyStorage, seller } = await deployContractFixture();

            const _kWh = 10;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 20);
            const sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(20);

            const response = await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            expect(response).to.emit(trading, 'TradeCreated');

        });

        it('should revert if price is too low', async () => {

            const { trading, energyStorage, seller } = await deployContractFixture();

            const _kWh = 10;
            const _pricePerkWh = hre.ethers.parseEther("0");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 20);
            const sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(20);

            await expect(trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds)).to.be.revertedWithCustomError(trading, 'ToLowPrice');

        });

        it('should revert if kWh is too low', async () => {

            const { trading, energyStorage, seller } = await deployContractFixture();

            const _kWh = 2;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 20);
            const sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(20);

            await expect(trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds)).to.be.revertedWithCustomError(trading, 'ToLowkWh');

        });


        it('should revert if user has insufficient energy in storage', async () => {

            const { trading, energyStorage, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 2);
            const sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(2);

            await expect(trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds)).to.be.revertedWithCustomError(trading, 'InsufficientEnergy');

        });


        it('should deduct energy from the sellers energy supply', async () => {

            const { trading, energyStorage, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);

            sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(5);

        });


        it('should add energy to the buyers energy supply', async () => {

            const { trading, energyStorage, buyer, seller } = await deployContractFixture();

            const _kWh = BigInt(5);
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];
            const _totalPriceInEth = _kWh * _pricePerkWh;

            await energyStorage.connect(seller).addEnergy(seller, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);

            sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(5);

            let buyerStorage = await energyStorage.connect(buyer).getEnergySupply(buyer);
            expect(buyerStorage).to.equal(0);

            const activeTrades = await trading.connect(buyer).getActiveTrades(gridId);
            expect(activeTrades[0].isActive).to.be.true;
            const tradeId = activeTrades[0].tradeId;

            await expect(trading.connect(buyer).buyTrade(gridId, tradeId, { value: _totalPriceInEth })).to.emit(trading, 'TradeBought');

            buyerStorage = await energyStorage.connect(buyer).getEnergySupply(buyer);
            expect(buyerStorage).to.equal(5);

        });

    });

    describe('cancelTrade', async () => {
        it('should revert with UnauthorizedAccess', async () => {
            const { trading, energyStorage, owner, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            const response = await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            expect(response).to.emit(trading, 'TradeCreated');

            const activeTrades = await trading.connect(owner).getActiveTrades(gridId);
            expect(activeTrades[0].isActive).to.be.true;
            const tradeId = activeTrades[0].tradeId;

            await expect(trading.connect(owner).cancelTrade(gridId, tradeId)).to.be.revertedWithCustomError(trading, 'UnauthorizedAccess');
        });

        it('should revert with TradeNotFound if trade ID does not exist', async () => {
            const { trading, owner } = await deployContractFixture();
            const tradeId = ethers.solidityPackedKeccak256(['string'], ['123']);
            await expect(trading.connect(owner).cancelTrade(gridId, tradeId)).to.be.revertedWithCustomError(trading, 'TradeNotFound');
        });

        it('should revert with TradeIsInactive', async () => {
            const { trading, energyStorage, owner, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            const response = await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            expect(response).to.emit(trading, 'TradeCreated');

            const activeTrades = await trading.connect(owner).getActiveTrades(gridId);
            expect(activeTrades[0].isActive).to.be.true;
            const tradeId = activeTrades[0].tradeId;

            await expect(trading.connect(seller).cancelTrade(gridId, tradeId));

            await expect(trading.connect(seller).cancelTrade(gridId, tradeId)).to.be.revertedWithCustomError(trading, 'TradeIsInactive');

        });


        it('should cancel an active trade', async () => {
            const { trading, energyStorage, owner, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            const response = await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            expect(response).to.emit(trading, 'TradeCreated');

            const activeTrades = await trading.connect(owner).getActiveTrades(gridId);
            expect(activeTrades[0].isActive).to.be.true;
            const tradeId = activeTrades[0].tradeId;

            await expect(trading.connect(seller).cancelTrade(gridId, tradeId)).to.emit(trading, 'TradeCancelled');

        });
    });


    describe('getActiveTrades', async () => {
        it('should return 1 active trade', async () => {
            const { trading, energyStorage, owner, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            let activeTrades = await trading.connect(owner).getActiveTrades(gridId);
            expect(activeTrades.length).to.equal(0);

            const response = await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            expect(response).to.emit(trading, 'TradeCreated');

            activeTrades = await trading.connect(owner).getActiveTrades(gridId);
            expect(activeTrades.length).to.equal(1);

        });
    });

    describe('buyTrade', () => {
        it('should successfully make a trade', async () => {
            const { trading, energyStorage, seller, buyer } = await deployContractFixture();

            const _kWh = BigInt(5);
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];
            const _totalPriceInEth = _kWh * _pricePerkWh;
            const _totalPriceInWei = hre.ethers.parseEther((_totalPriceInEth).toString());

            // Setup
            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            const sellerStorageBefore = await energyStorage.getEnergySupply(seller);
            const buyerStorageBefore = await energyStorage.getEnergySupply(buyer);
            const buyerBalanceBefore = await hre.ethers.provider.getBalance(buyer.address);
            const sellerBalanceBefore = await hre.ethers.provider.getBalance(seller.address);

            // Create trade
            await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            let activeTrades = await trading.getActiveTrades(gridId);
            let tradeId = activeTrades[0].tradeId;

            // Execute trade
            const totalPriceInWei = hre.ethers.parseEther((_totalPriceInEth).toString());
            const tx = await trading.connect(buyer).buyTrade(gridId, tradeId, { value: _totalPriceInEth });
            const receipt = await tx.wait();

            // Post-trade verification
            const sellerStorageAfter = await energyStorage.getEnergySupply(seller);
            const buyerStorageAfter = await energyStorage.getEnergySupply(buyer);
            const buyerBalanceAfter = await hre.ethers.provider.getBalance(buyer.address);
            const sellerBalanceAfter = await hre.ethers.provider.getBalance(seller.address);

            expect(sellerStorageBefore - sellerStorageAfter).to.equal(5);
            expect(buyerStorageAfter - buyerStorageBefore).to.equal(5);

            // Verify trade is no longer active
            const remainingTrades = await trading.getActiveTrades(gridId);
            expect(remainingTrades.length).to.equal(0);

        });

        it('should revert to IncorrectPayment', async () => {
            const { trading, energyStorage, seller, buyer } = await deployContractFixture();

            const _kWh = BigInt(5);
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];
            const _totalPriceInEth = _kWh * _pricePerkWh;
            const _incorrectPayment = 1;

            // Setup
            await energyStorage.connect(seller).addEnergy(seller.address, 10);

            // Create trade
            await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            let activeTrades = await trading.getActiveTrades(gridId);
            let tradeId = activeTrades[0].tradeId;

            // Execute trade
            await expect(trading.connect(buyer).buyTrade(gridId, tradeId, { value: _incorrectPayment })).to.be.revertedWithCustomError(trading, 'IncorrectPayment');

        });

        it('should revert to TradeIsInactive', async () => {
            const { trading, energyStorage, buyer, seller } = await deployContractFixture();

            const _kWh = 5;
            const _pricePerkWh = hre.ethers.parseEther("0.001");
            const _sourceTypeIds = [1, 2];

            await energyStorage.connect(seller).addEnergy(seller.address, 10);
            let sellerStorage = await energyStorage.connect(seller).getEnergySupply(seller);
            expect(sellerStorage).to.equal(10);

            const response = await trading.connect(seller).createTrade(gridId, _kWh, _pricePerkWh, _sourceTypeIds);
            expect(response).to.emit(trading, 'TradeCreated');

            const activeTrades = await trading.connect(buyer).getActiveTrades(gridId);
            expect(activeTrades[0].isActive).to.be.true;
            const tradeId = activeTrades[0].tradeId;

            await expect(trading.connect(seller).cancelTrade(gridId, tradeId)).to.emit(trading, 'TradeCancelled');

            await expect(trading.connect(buyer).buyTrade(gridId, tradeId)).to.be.revertedWithCustomError(trading, 'TradeIsInactive');
        });

    });

    describe('addSourceType', () => {

        it('should revert to UnauthorizedAccess', async () => {
            const { trading, seller } = await deployContractFixture();
            await expect(trading.connect(seller).addSourceType(4, 'Space', 'Energy from space.')).to.be.revertedWithCustomError(trading, 'UnauthorizedAccess');
        });

        it('should successfully add a new sourcetype', async () => {
            const { trading, owner } = await deployContractFixture();
            await expect(trading.connect(owner).addSourceType(4, 'Space', 'Energy from space.')).to.emit(trading, 'SourceTypeAdded');
        });

        it('should revert to SourceTypeAlreadyExists', async () => {
            const { trading, owner } = await deployContractFixture();
            await expect(trading.connect(owner).addSourceType(1, 'Space', 'Energy from space.')).to.be.revertedWithCustomError(trading, 'SourceTypeAlreadyExists');
        });

    });

    describe('getSourceType', () => {
        it('should return source type data', async () => {
            const { trading, seller } = await deployContractFixture();
            const response = await trading.connect(seller).getSourceType(1);
            expect(response).not.equal(null);
        });
    })

    describe('fallback', async () => {
        it('should emit invalidCall when fallback function is called', async () => {
            const { trading, owner } = await deployContractFixture();
            await expect(
                owner.sendTransaction({
                    to: trading.getAddress(),
                    data: "0x12345678"
                })
            ).to.be.revertedWithCustomError(trading, 'FallbackNotSupported');
        });
    });

    describe('receive', () => {
        it('should revert with DirectPaymentsNotAllowed when receiving Ether directly', async () => {
            const { trading, owner, seller } = await deployContractFixture();
            await expect(
                owner.sendTransaction({
                    to: trading.getAddress(),
                    value: ethers.parseEther("1.0")
                })
            ).to.be.revertedWithCustomError(trading, 'DirectPaymentsNotAllowed');
        });
    });

});
