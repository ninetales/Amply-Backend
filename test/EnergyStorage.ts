import { expect } from 'chai';
import hre from 'hardhat';
import ethers from 'ethers';

describe('EnergyStorage', async () => {

    async function deployContractFixture() {
        const [owner, addr1, addr2] = await hre.ethers.getSigners();
        const EnergyStorage = await hre.ethers.getContractFactory('EnergyStorage');
        const energyStorage = await EnergyStorage.deploy();
        await energyStorage.waitForDeployment();
        return { energyStorage, owner, addr1, addr2 };
    }

    describe('Contract deployment', async () => {

        it('should deploy the contract successfully', async () => {
            const { energyStorage } = await deployContractFixture();
            const contractAddress = await energyStorage.getAddress();
            expect(contractAddress).to.be.a("string");
            expect(contractAddress).to.not.equal("0x0000000000000000000000000000000000000000");
            expect(contractAddress).to.be.properAddress;
        });

    });

    describe('addEnergy', async () => {

        it('should revert if the user tries using another address', async () => {
            const { energyStorage, addr1, addr2 } = await deployContractFixture();
            await expect(energyStorage.connect(addr1).addEnergy(addr2, 5)).to.be.revertedWithCustomError(energyStorage, 'UnauthorizedAccess');
        });

        it('should revert if the user tries to add to little kWh', async () => {
            const { energyStorage, addr1 } = await deployContractFixture();
            await expect(energyStorage.connect(addr1).addEnergy(addr1, 0)).to.be.revertedWithCustomError(energyStorage, 'ToLowkWh');
        });

        it('should add 5 kWh energy to the users storage', async () => {
            const { energyStorage, addr1 } = await deployContractFixture();
            let userEnergyStorage = await energyStorage.connect(addr1).getEnergySupply(addr1);
            expect(userEnergyStorage).to.equal(0);
            await energyStorage.connect(addr1).addEnergy(addr1, 5);
            userEnergyStorage = await energyStorage.connect(addr1).getEnergySupply(addr1);
            expect(userEnergyStorage).to.equal(5);
        });

    });

    describe('reduceEnergy', async () => {
        it('should revert if the user tries using another address', async () => {
            const { energyStorage, addr1, addr2 } = await deployContractFixture();
            await expect(energyStorage.connect(addr1).reduceEnergy(addr2, 5)).to.be.revertedWithCustomError(energyStorage, 'UnauthorizedAccess');
        });

        it('should revert if the user tries to remove to much kWh', async () => {
            const { energyStorage, addr1 } = await deployContractFixture();
            await expect(energyStorage.connect(addr1).reduceEnergy(addr1, 5)).to.be.revertedWithCustomError(energyStorage, 'EnergySupplyToLow');
        });

        it('should remove 5 kWh energy to the users storage', async () => {
            const { energyStorage, addr1 } = await deployContractFixture();

            let userEnergyStorage = await energyStorage.connect(addr1).getEnergySupply(addr1);
            expect(userEnergyStorage).to.equal(0);

            await energyStorage.connect(addr1).addEnergy(addr1, 5);
            userEnergyStorage = await energyStorage.connect(addr1).getEnergySupply(addr1);
            expect(userEnergyStorage).to.equal(5);

            await energyStorage.connect(addr1).reduceEnergy(addr1, 5);
            userEnergyStorage = await energyStorage.connect(addr1).getEnergySupply(addr1);
            expect(userEnergyStorage).to.equal(0);
        });

    });

    describe('setTradingContract', () => {

        it('should revert with UnauthorizedAccess error', async () => {
            const { energyStorage, addr1 } = await deployContractFixture();
            await expect(energyStorage.connect(addr1).setTradingContract('0x0000000000000000000000000000000000000000')).to.be.revertedWithCustomError(energyStorage, 'UnauthorizedAccess');
        });

        it('should add trading contract address', async () => {
            const { energyStorage, owner } = await deployContractFixture();
            await expect(energyStorage.connect(owner).setTradingContract('0x0000000000000000000000000000000000000000')).to.emit(energyStorage, 'TradingAddressAdded');
        });
    });

    describe('getEnergySupply', async () => {
        it('should return the users energy storage', async () => {
            const { energyStorage, addr1 } = await deployContractFixture();
            let userEnergyStorage = await energyStorage.connect(addr1).getEnergySupply(addr1);
            expect(userEnergyStorage).to.equal(0);
        });
    });

});