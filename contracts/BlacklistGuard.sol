// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "@gnosis.pm/zodiac/contracts/guard/BaseGuard.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";
import "@gnosis.pm/zodiac/contracts/core/Modifier.sol";

contract BlacklistGuard is FactoryFriendly, BaseGuard {
    event SetTarget(
        address target,
        bool blockAll,
        bool delegateCallBlocked,
        bytes4 functionHash,
        bool blockFunction
    );

    event SetExceptionalSender(address target, address exceptionalSender);

    event BlacklistGuardSetup(address initiator, address indexed owner);

    struct Target {
        bool allBlocked;
        bool delegateCallBlocked;
        mapping(bytes4 => bool) blockedFunctions;
    }

    mapping(address => Target) public blockedTargets;

    constructor(address _owner) {
        bytes memory initializeParams = abi.encode(_owner);
        setUp(initializeParams);
    }

    /// @dev Initialize function, will be triggered when a new proxy is deployed
    /// @param initializeParams Parameters of initialization encoded
    function setUp(bytes memory initializeParams) public override {
        __Ownable_init();
        address _owner = abi.decode(initializeParams, (address));

        transferOwnership(_owner);
        emit BlacklistGuardSetup(msg.sender, _owner);
    }

    /// @dev set the Target being Blocked. Only  Owner can call.
    function setTarget(
        address target,
        bool blockAll,
        bool blockDelegateCall,
        bytes4 functionHash,
        bool blockFunction
    ) external onlyOwner {
        Target storage thisTarget = blockedTargets[target];
        thisTarget.allBlocked = blockAll;
        thisTarget.delegateCallBlocked = blockDelegateCall;
        thisTarget.blockedFunctions[functionHash] = blockFunction;

        emit SetTarget(
            target,
            blockAll,
            blockDelegateCall,
            functionHash,
            blockFunction
        );
    }

    function isTargetAllBlocked(address target) public view returns (bool) {
        return (blockedTargets[target].allBlocked);
    }

    function isFunctionBlocked(address target, bytes4 functionSig)
        public
        view
        returns (bool)
    {
        return (blockedTargets[target].blockedFunctions[functionSig]);
    }

    function isDelegateCallBlocked(address target) public view returns (bool) {
        return (blockedTargets[target].delegateCallBlocked);
    }

    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    function checkTransaction(
        address to,
        uint256,
        bytes memory data,
        Enum.Operation operation,
        uint256,
        uint256,
        uint256,
        address,
        // solhint-disallow-next-line no-unused-vars
        address payable,
        bytes memory,
        address
    ) external view override {
        require(!blockedTargets[to].allBlocked, "Target address is blocked");

        require(
            !((operation == Enum.Operation.DelegateCall) &&
                blockedTargets[to].delegateCallBlocked),
            "Delegate call not allowed to this address"
        );

        require(
            !blockedTargets[to].blockedFunctions[bytes4(data)],
            "The function call to the target is blocked"
        );
    }

    function checkAfterExecution(bytes32, bool) external view override {}
}
