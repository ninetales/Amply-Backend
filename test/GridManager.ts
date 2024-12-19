import { expect } from 'chai';
import hre from "hardhat";
import { ethers } from 'ethers';



describe('GridManager', () => {

    const gridName = 'Grid-1';
    const countryCode = 'SE';
    const country = 'Sweden';
    const gridId = ethers.solidityPackedKeccak256(['string', 'string'], [gridName, countryCode]);

    async function deployContractFixture() {
        const [owner, addr1, addr2] = await hre.ethers.getSigners();
        const GridManager = await hre.ethers.getContractFactory('GridManager');
        const gridManager = await GridManager.deploy();

        await gridManager.waitForDeployment();

        return { gridManager, owner, addr1, addr2 };
    }

    describe('Contract deployment', async () => {
        it('should deploy the contract successfully', async () => {
            const { gridManager } = await deployContractFixture();

            const contractAddress = await gridManager.getAddress();
            expect(contractAddress).to.be.a("string");
            expect(contractAddress).to.not.equal("0x0000000000000000000000000000000000000000");
            expect(contractAddress).to.be.properAddress;
        });


    });

    describe('createGrid', async () => {

        it('should create a new grid with an authorized wallet address', async () => {
            const { gridManager, owner } = await deployContractFixture();
            await expect(gridManager.connect(owner).createGrid('grid-123', 'SE', 'Sweden')).to.emit(gridManager, 'NewGridCreated');
        });

        it('should revert if not called by authorized grid station', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            await expect(gridManager.connect(addr1).createGrid('grid-123', 'SE', 'Sweden')).to.be.revertedWithCustomError(gridManager, 'NotAuthorized');
        });

        it('should generate an error if grid id already exists', async () => {
            const { gridManager, owner } = await deployContractFixture();
            await expect(gridManager.connect(owner).createGrid(gridName, countryCode, country)).to.be.revertedWithCustomError(gridManager, 'DuplicateGridId');
        });

    });

    describe('addAuthorizedDevice', async () => {

        it('should add a new address to authorized addresses', async () => {
            const { gridManager, owner, addr1 } = await deployContractFixture();
            await expect(gridManager.connect(owner).addAuthorizedDevice(addr1)).to.emit(gridManager, 'AuthorizedNewDevice');
        });

        it('should revert with an error if not owner of the contract', async () => {
            const { gridManager, addr1, addr2 } = await deployContractFixture();
            await expect(gridManager.connect(addr1).addAuthorizedDevice(addr2)).to.be.revertedWithCustomError(gridManager, 'NotAdmin');
        });

    });

    describe('listGridIds', async () => {

        it('should return an array of grid ids', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            const grids = await gridManager.connect(addr1).listGridIds();
            expect(grids).to.be.an('array');
        });

    });

    describe('listGrids', async () => {
        it('should return data as an array', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            const grids = await gridManager.connect(addr1).listGrids();
            expect(grids).to.be.an('array');
        });

        it('should return a struct', async () => {
            const { gridManager, owner } = await deployContractFixture();
            const gridName = 'Lorem';
            const countryCode = 'SE';
            const countryName = 'Sweden';

            await gridManager.connect(owner).createGrid(gridName, countryCode, country);

            const gridIds = await gridManager.connect(owner).listGridIds();
            const grids = await gridManager.connect(owner).listGrids();

            const lastGridId = gridIds.length - 1;
            const gridData = grids[lastGridId];

            expect(gridData.name).to.equal(gridName);
            expect(gridData.countryCode).to.equal(countryCode);
            expect(gridData.countryName).to.equal(countryName);
            expect(gridData.userCount).to.equal(0);
            expect(gridData.createdBy).to.equal(owner.address);
            expect(gridData.exists).to.be.true;
            expect(gridData.id).to.equal(gridIds[lastGridId]);
        });
    });

    describe('isUserConnected', async () => {
        it('should be reverted if no user is found', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            await expect(gridManager.connect(addr1).isUserConnected(addr1)).to.be.revertedWithCustomError(gridManager, 'NoUserInGrid');
        });

        it('should return true if user is connected', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            const gridIds = await gridManager.connect(addr1).listGridIds();
            const randomGridId = gridIds[0];
            await expect(gridManager.connect(addr1).addUserToGrid(randomGridId)).to.emit(gridManager, 'UserConnectedToGrid');

            const isConnected = await gridManager.connect(addr1).isUserConnected(addr1);
            expect(isConnected).to.equal(true);
        });

    });

    describe('getUserGridData', async () => {
        it('should revert if user is not connected to a grid', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            await expect(gridManager.connect(addr1).getUserGridData(addr1)).to.be.revertedWithCustomError(gridManager, 'NoUserInGrid');
        });

        it('should return a struct of grid data if user is connected', async () => {
            const { gridManager, owner, addr1 } = await deployContractFixture();
            const gridIds = await gridManager.connect(addr1).listGridIds();
            const randomGridId = gridIds[0];
            await gridManager.connect(addr1).addUserToGrid(randomGridId);
            const gridsData = await gridManager.connect(addr1).listGrids();

            const existingGridData = gridsData.find(grid => grid.id === randomGridId);

            expect(existingGridData).to.not.be.undefined;

            const userConnectedGridData = await gridManager.connect(addr1).getUserGridData(addr1);

            expect(existingGridData.name).to.equal(userConnectedGridData.name);
            expect(existingGridData.countryCode).to.equal(userConnectedGridData.countryCode);
            expect(existingGridData.countryName).to.equal(userConnectedGridData.countryName);
            expect(existingGridData.userCount).to.equal(1);
            expect(existingGridData.createdBy).to.equal(owner.address);
            expect(existingGridData.exists).to.be.true;
            expect(existingGridData.id).to.equal(randomGridId);

        });
    });

    describe('addUserToGrid', async () => {

        it('should add a user to a grid', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            await expect(gridManager.connect(addr1).addUserToGrid(gridId)).to.emit(gridManager, 'UserConnectedToGrid');
        });

        it('should revert with an error if user already exists', async () => {
            const { gridManager, owner, addr1 } = await deployContractFixture();
            await gridManager.connect(addr1).addUserToGrid(gridId);
            await expect(gridManager.connect(addr1).addUserToGrid(gridId)).to.be.revertedWithCustomError(gridManager, 'UserAlreadyInGrid');
        });

        it('should revert with an error if no grid is found', async () => {
            const { gridManager, owner } = await deployContractFixture();
            const badGridId = ethers.solidityPackedKeccak256(['string', 'string'], ['noName', 'NO']);
            await expect(gridManager.connect(owner).addUserToGrid(badGridId)).to.be.revertedWithCustomError(gridManager, 'NoGridFound');
        });

    });

    describe('fallback', async () => {
        it('should emit invalidCall when fallback function is called', async () => {
            const { gridManager, addr1 } = await deployContractFixture();
            // @ts-ignore
            // await expect(gridManager.nonExistentFunction()).to.be.revertedWithCustomError(gridManager, 'InvalidCall');
            await expect(
                addr1.sendTransaction({
                    to: gridManager.getAddress(),
                    data: "0x12345678"
                })
            ).to.be.revertedWithCustomError(gridManager, 'InvalidCall');
        });
    });

});