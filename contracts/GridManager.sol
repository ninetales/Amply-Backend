// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

contract GridManager {
    address private owner;
    bytes32[] public gridIds;

    constructor() {
        owner = msg.sender;
        addAuthorizedDevice(msg.sender);

        createGrid('Helsingborg', 'SE', 'Sweden');
        createGrid("Copenhagen", "DK", "Denmark");
        createGrid("Oslo", "NO", "Norway");
        createGrid("Helsinki", "FI", "Finland");
        createGrid("London", "GB", "United Kingdom");
        createGrid("Milano", "IT", "Italy");
    }

    // ==============================================================
    // Errors
    // ==============================================================
    error DuplicateGridId(bytes32 gridId);
    error UserAlreadyInGrid(bytes32 gridId, address user);
    error NoGridFound(bytes32 gridId);
    error NoUserInGrid(address _user);
    error NotAuthorized(address device);
    error NotAdmin(address user);
    error InvalidCall(address sender);

    // ==============================================================
    // Events
    // ==============================================================
    event NewGridCreated(bytes32 gridId, string name, string countryCode, string countryName);
    event UserConnectedToGrid(address user, bytes32 gridId);
    event UserRemovedFromGrid(address user);
    event AuthorizedNewDevice(address device);

    // ==============================================================
    // Structs
    // ==============================================================
    struct Grid {
        bytes32 id;
        string name;
        string countryCode;
        string countryName;
        uint256 userCount;
        address createdBy;
        bool exists;
    }

    // ==============================================================
    // Maps
    // ==============================================================
    mapping (bytes32 => Grid) public grids;
    mapping(address => bytes32) public userInGrid;
    mapping(address => bool) public authorizedGridStations;

    // ==============================================================
    // Modifiers
    // ==============================================================
    modifier onlyOwner() {
        if(msg.sender != owner) revert NotAdmin(msg.sender);
        _;
    }

    modifier onlyAuthorizedGridStations() {
        if(!authorizedGridStations[msg.sender]) revert NotAuthorized(msg.sender);
        _;
    }

    // ==============================================================
    // Functions
    // ==============================================================
    function createGrid(string memory _name, string memory _countryCode, string memory _countryName) public onlyAuthorizedGridStations {
        bytes32 _gridId = keccak256(abi.encodePacked(_name, _countryCode));
        
        if(grids[_gridId].exists) revert DuplicateGridId(_gridId);

        grids[_gridId] = Grid({
            id: _gridId,
            name: _name,
            countryCode: _countryCode,
            countryName: _countryName,
            userCount: 0,
            createdBy: msg.sender,
            exists: true
        });

        gridIds.push(_gridId);

        emit NewGridCreated(_gridId, _name, _countryCode, _countryName);
    }

    function addAuthorizedDevice(address _device) public onlyOwner {
        authorizedGridStations[_device] = true;

        emit AuthorizedNewDevice(_device);
    }

    function isUserConnected(address _user) public view returns (bool){
        if(userInGrid[_user] == bytes32(0)) revert NoUserInGrid(_user);

        return true;
    }

    function getUserGridData(address _user) public view returns(Grid memory){
        isUserConnected(_user);

        bytes32 _gridId = userInGrid[_user];

        return grids[_gridId];
    }

    function addUserToGrid(bytes32 _gridId) public {
        if(!grids[_gridId].exists) revert NoGridFound(_gridId);
        if(userInGrid[msg.sender] != bytes32(0)) revert UserAlreadyInGrid(_gridId, msg.sender);

        userInGrid[msg.sender] = _gridId;
        grids[_gridId].userCount++;

        emit UserConnectedToGrid(msg.sender, _gridId);
    }

    function removeUserFromGrid() public {
        
        bytes32 _gridId = userInGrid[msg.sender];
        grids[_gridId].userCount--;
        delete userInGrid[msg.sender];
        
        emit UserRemovedFromGrid(msg.sender);
    }

    function listGridIds() public view returns (bytes32[] memory) {
        return gridIds;
    }

    function listGrids() public view returns (Grid[] memory) {
        Grid[] memory gridList = new Grid[](gridIds.length);

        for (uint i = 0; i < gridIds.length; i++) {
            bytes32 currentId = gridIds[i];
            Grid storage currentGrid = grids[currentId];

            gridList[i] = Grid({
                id: currentId,
                name: currentGrid.name,
                countryCode: currentGrid.countryCode,
                countryName: currentGrid.countryName,
                userCount: currentGrid.userCount,
                createdBy: currentGrid.createdBy,
                exists: currentGrid.exists
            });
        }

        return gridList;
    }

    // ==============================================================
    // Fallback
    // ==============================================================
    fallback() external {
        revert InvalidCall(msg.sender);
    }
}