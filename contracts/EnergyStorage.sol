// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

contract EnergyStorage {
    address private owner;

    constructor() {
        owner = msg.sender;
    }

    // ==============================================================
    // Errors
    // ==============================================================
    error ToLowkWh(uint256 kWh);
    error EnergySupplyToLow(uint256 kWh);
    error UnauthorizedAccess();
    error TradingContractNotSet();


    // ==============================================================
    // Events
    // ==============================================================
    event TradingAddressAdded(address tradingContractAddress);
    event ReducedEnergy(address user, uint256 kWh);
    event AddedEnergy(address user, uint256 kWh);

    // ==============================================================
    // Maps
    // ==============================================================
    mapping (address => uint256) public energySupply;

    // ==============================================================
    // Modifiers
    // ==============================================================
    modifier onlyAuthorized(address _user) {
        if (msg.sender != _user && msg.sender != tradingContract) {
            revert UnauthorizedAccess();
        }
        _;
    }


    // ==============================================================
    // Trusted Contracts
    // ==============================================================
    address public tradingContract;

    // ==============================================================
    // Functions
    // ==============================================================
    function setTradingContract(address _tradingContract) external {
        if(msg.sender != owner) revert UnauthorizedAccess();
        tradingContract = _tradingContract;

        emit TradingAddressAdded(_tradingContract);
    }

    function addEnergy(address _user, uint256 _kWh) external onlyAuthorized(_user) {
        if(_kWh <= 0) revert ToLowkWh(_kWh);
        energySupply[_user] += _kWh;

        emit AddedEnergy(_user, _kWh);
    }

    function reduceEnergy(address _user, uint256 _kWh) external onlyAuthorized(_user) {
        if(energySupply[_user] < _kWh) revert EnergySupplyToLow(_kWh);
        energySupply[_user] -= _kWh;
        
        emit ReducedEnergy(_user, _kWh);
    }

    function getEnergySupply(address _user) external view returns(uint256) {
        return energySupply[_user];
    }

}