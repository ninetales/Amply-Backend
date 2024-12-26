// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface EnergyStorage {
    function getEnergySupply(address _user) external view returns (uint256);
    function reduceEnergy(address _user, uint256 _kWh) external;
    function addEnergy(address _user, uint256 _kWh) external;
}

contract Trading is ReentrancyGuard {
    address private owner;
    uint256 private constant MINIMUM_PRICE = 1;
    uint256 private constant MINIMUM_KWH = 3;


    constructor() {
        owner = msg.sender;
        addSourceType(1, 'Solar', 'Energy harvested from sunlight');
        addSourceType(2, 'Wind', 'Energy generated from wind power');
        addSourceType(3, 'Water', 'Energy produced from hydroelectric sources');
    }


    // ==============================================================
    // Errors
    // ==============================================================
    error IncorrectPayment(uint256 sent, uint256 required);
    error ToLowPrice(uint256 price);
    error ToLowkWh(uint256 kWh);
    error UnauthorizedAccess();
    error TradeIsInactive();
    error InsufficientEnergy(uint256 available, uint256 required);
    error TradeNotFound();
    error TransferFailed();
    error SourceTypeAlreadyExists();
    error FallbackNotSupported();
    error DirectPaymentsNotAllowed();

    // ==============================================================
    // Events
    // ==============================================================
    event EnergyStorageContractSet(address indexed energyStorageAddress);
    event TradeCreated(
        bytes32 indexed tradeId,
        address indexed seller,
        bytes32 gridId,
        uint256 kWh,
        uint256 pricePerkWh,
        uint256[] sourceTypeIds
    );
    event TradeCancelled(bytes32 tradeId, bytes32 gridId);
    event TradeBought(bytes32 tradeId, bytes32 gridId, address sender, uint256 tradekWh, uint256 totalPrice);
    event SourceTypeAdded(uint256 indexed id, string name, string description);

    // ==============================================================
    // Structs
    // ==============================================================
    struct Trade {
        bytes32 gridId;
        uint256 kWh;
        uint256 pricePerkWh;
        bytes32 tradeId;
        address seller;
        bool isActive;
        uint256[] sourceTypeIds; 
    }

    struct SourceType {
        string name;
        string description;
    }

    // ==============================================================
    // Maps
    // ==============================================================
    mapping(bytes32 => Trade[]) private gridTrades;
    mapping(bytes32 => mapping(bytes32 => uint256)) public tradeIndices;
    mapping(uint256 => SourceType) public sourceTypes; 

    // ==============================================================
    // Trusted Contracts
    // ==============================================================
    EnergyStorage public energyStorage;

    // ==============================================================
    // Modifiers
    // ==============================================================
    modifier onlyAuthorized() {
        if(msg.sender != owner) revert UnauthorizedAccess();
        _;
    }

    // ==============================================================
    // Functions
    // ==============================================================

    function setEnergyStorageContract(address _energyStorageContract) external onlyAuthorized {
        energyStorage = EnergyStorage(_energyStorageContract);
        emit EnergyStorageContractSet(_energyStorageContract);
    }

    function createTrade(bytes32 _gridId, uint256 _kWh, uint256 _pricePerkWh, uint256[] calldata _sourceTypeIds) public {
        if(_pricePerkWh < MINIMUM_PRICE) revert ToLowPrice(_pricePerkWh);

        if(_kWh < MINIMUM_KWH) revert ToLowkWh(_kWh);

        // Check if the user has enough energy to trade
        uint256 availableEnergy = energyStorage.getEnergySupply(msg.sender);
        if (availableEnergy < _kWh) revert InsufficientEnergy(availableEnergy, _kWh);

        // Deduct energy from the seller's energy supply
        energyStorage.reduceEnergy(msg.sender, _kWh);

        // Generate a unique trade ID
        bytes32 tradeId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                _gridId,
                _kWh,
                _pricePerkWh
            )
        );

        // Create a new trade
        Trade memory newTrade = Trade({
            seller: msg.sender,
            tradeId: tradeId,
            gridId: _gridId,
            kWh: _kWh,
            pricePerkWh: _pricePerkWh,
            sourceTypeIds: _sourceTypeIds,
            isActive: true
        });

        // Add the new trade to the grid
        gridTrades[_gridId].push(newTrade);

        // Store the index in the tradeIndices mapping
        tradeIndices[_gridId][tradeId] = gridTrades[_gridId].length - 1;

        // Emit event for trade creation
        emit TradeCreated(tradeId, msg.sender, _gridId, _kWh, _pricePerkWh, _sourceTypeIds);
    }


    function findTradeIndex(bytes32 _gridId, bytes32 _tradeId) internal view returns (uint256) {
        if (tradeIndices[_gridId][_tradeId] == 0 && gridTrades[_gridId].length == 0) {
            revert TradeNotFound();
        }

        uint256 index = tradeIndices[_gridId][_tradeId];

        if (gridTrades[_gridId][index].tradeId != _tradeId) {
            revert TradeNotFound();
        }

        return index;
    }


    function cancelTrade(bytes32 _gridId, bytes32 _tradeId) external {
        uint256 tradeIndex = findTradeIndex(_gridId, _tradeId);
        Trade storage trade = gridTrades[_gridId][tradeIndex];
        if (trade.seller != msg.sender) revert UnauthorizedAccess();
        if (!trade.isActive) revert TradeIsInactive();
        
         // Unlock energy to the seller
        energyStorage.addEnergy(msg.sender, trade.kWh);
        
        trade.isActive = false;
        emit TradeCancelled(_tradeId, _gridId);
    }

    function getActiveTrades(bytes32 _gridId) external view returns (Trade[] memory) {
        Trade[] memory allTrades = gridTrades[_gridId];
        Trade[] memory activeTrades = new Trade[](allTrades.length);
        uint256 index = 0;

        for (uint256 i = 0; i < allTrades.length; i++) {
            if (allTrades[i].isActive) {
                activeTrades[index] = allTrades[i];
                index++;
            }
        }

        // Resize the array to the actual count of active trades
        assembly {
            mstore(activeTrades, index)
        }

        return activeTrades;
    }


    function buyTrade(bytes32 _gridId, bytes32 _tradeId) external payable nonReentrant {

        uint256 tradeIndex = findTradeIndex(_gridId, _tradeId);
        Trade storage trade = gridTrades[_gridId][tradeIndex];

        // Check if trade is active
        if (!trade.isActive) revert TradeIsInactive();

        // Calculate total price for the trade
        uint256 totalPrice = trade.kWh * trade.pricePerkWh;

        // Check if the buyer sent the exact amount of ETH required
        if (msg.value != totalPrice) revert IncorrectPayment(msg.value, totalPrice);

        // Transfer funds to the seller
        (bool success, ) = trade.seller.call{value: totalPrice}("");
        if(!success) revert TransferFailed();

        // Add energy to the buyer's account
        energyStorage.addEnergy(msg.sender, trade.kWh);

        // Mark the trade as inactive
        trade.isActive = false;

        // Emit TradeBought event
        emit TradeBought(_tradeId, _gridId, msg.sender, trade.kWh, totalPrice);
    }

    function addSourceType(uint256 _id, string memory _name, string memory _description) public onlyAuthorized {
        if (bytes(sourceTypes[_id].name).length != 0) revert SourceTypeAlreadyExists();
        sourceTypes[_id] = SourceType({name: _name, description: _description});
        
        emit SourceTypeAdded(_id, _name, _description);
    }

    function getSourceType(uint256 _sourceTypeId) public view returns (SourceType memory) {
        return sourceTypes[_sourceTypeId];
    }

    
    // ==============================================================
    // Fallback
    // ==============================================================
    fallback() external {
        revert FallbackNotSupported();
    }

    receive() external payable {
        revert DirectPaymentsNotAllowed();
    }

}