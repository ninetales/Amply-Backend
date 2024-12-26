import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const TradingModule = buildModule("Trading", (m) => {

    const trading = m.contract("Trading");
    return { trading };
});

module.exports = TradingModule;