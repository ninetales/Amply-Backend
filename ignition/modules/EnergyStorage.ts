import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const EnergyStorageModule = buildModule("EnergyStorage", (m) => {

    const energyStorage = m.contract("EnergyStorage");
    return { energyStorage };
});

module.exports = EnergyStorageModule;