import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const GridManagerModule = buildModule("GridManager", (m) => {

    const gridManager = m.contract("GridManager");
    return { gridManager };
});

module.exports = GridManagerModule;