// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "@gnosis.pm/zodiac/contracts/guard/BaseGuard.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";
import "@gnosis.pm/zodiac/contracts/core/Modifier.sol";

interface Exectuer {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external returns (bool success);
}

contract BlacklistGuard is FactoryFriendly, BaseGuard {
    event SetTarget(
        address target,
        bool blockAll,
        bool delegateCallBlocked,
        bytes4 functionHash,
        bool blockFunction
    );

    event SetExceptionalSender(address target, address exceptionalSender);

    event BlacklistGuardSetup(
        address initiator,
        address indexed owner,
        address indexed avator,
        address executor
    );

    struct Target {
        bool allBlocked;
        bool delegateCallBlocked;
        mapping(bytes4 => bool) blockedFunctions;
        address exceptFromSender;
    }

    struct SafeArgs {
        uint256 safeTxGas;
        uint256 baseGas;
        uint256 gasPrice;
        address gasToken;
        address payable refundReceiver;
        bytes signatures;
    }

    mapping(address => Target) public blockedTargets;

    address public avator;
    Exectuer public executor;

    modifier onlyAvatorAndOwner() {
        require(
            msg.sender == avator || msg.sender == owner(),
            "Only 'avator' and owner can call"
        );
        _;
    }

    constructor(
        address _owner,
        address _avator,
        address _executor
    ) {
        bytes memory initializeParams = abi.encode(_owner, _avator, _executor);
        setUp(initializeParams);
    }

    /// @dev Initialize function, will be triggered when a new proxy is deployed
    /// @param initializeParams Parameters of initialization encoded
    function setUp(bytes memory initializeParams) public override {
        __Ownable_init();
        (address _owner, address _avator, address _executor) = abi.decode(
            initializeParams,
            (address, address, address)
        );

        transferOwnership(_owner);
        avator = _avator;
        executor = Exectuer(_executor);

        emit BlacklistGuardSetup(msg.sender, _owner, _avator, _executor);
    }

    /// @dev set the Target being Blocked. Only Avator or Owner can call.
    function setTarget(
        address target,
        bool blockAll,
        bool blockDelegateCall,
        bytes4 functionHash,
        bool blockFunction
    ) external onlyAvatorAndOwner {
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

    function setExceptionalSender(address target, address exceptionalSender)
        external
        onlyAvatorAndOwner
    {
        blockedTargets[target].exceptFromSender = exceptionalSender;
        emit SetExceptionalSender(target, exceptionalSender);
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

    function getExceptionalSender(address target)
        public
        view
        returns (address)
    {
        return blockedTargets[target].exceptFromSender;
    }

    ///@dev request the executor to call Avatar exec function. Then avatar run the Transaction for calling setTarget.
    function requestSetTarget(
        address target,
        bool blockAll,
        bool blockDelegateCall,
        bytes4 functionHash,
        bool blockFunction,
        SafeArgs calldata safeArgs
    ) public {
        bytes memory payload = encodeSetTargetData(
            target,
            blockAll,
            blockDelegateCall,
            functionHash,
            blockFunction
        );
        sendSafeTransaction(payload, safeArgs);
    }

    ///@dev request the executor to call Avatar exec function. Then avatar run the Transaction.
    function requestSetExceptionalSender(
        address target,
        address exceptionalSender,
        SafeArgs calldata safeArgs
    ) public {
        bytes memory payload = encodeSetExecptionalSender(
            target,
            exceptionalSender
        );
        sendSafeTransaction(payload, safeArgs);
    }

    function encodeSetTargetData(
        address target,
        bool blockAll,
        bool blockDelegateCall,
        bytes4 functionHash,
        bool blockFunction
    ) public pure returns (bytes memory) {
        bytes memory payload = abi.encodeWithSignature(
            "setTarget(address,bool,bool,bytes4,bool)",
            target,
            blockAll,
            blockDelegateCall,
            functionHash,
            blockFunction
        );
        return payload;
    }

    function encodeSetExecptionalSender(
        address target,
        address exceptionalSender
    ) public pure returns (bytes memory) {
        bytes memory payload = abi.encodeWithSignature(
            "setExceptionalSender(address,address)",
            target,
            exceptionalSender
        );
        return payload;
    }

    function sendSafeTransaction(bytes memory data, SafeArgs calldata safeArgs)
        internal
    {
        string
            memory funcSig = "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)";

        bytes memory payload = abi.encodeWithSignature(
            funcSig,
            address(this),
            0,
            data,
            Enum.Operation.Call,
            safeArgs.safeTxGas,
            safeArgs.baseGas,
            safeArgs.gasPrice,
            safeArgs.gasToken,
            safeArgs.refundReceiver,
            safeArgs.signatures
        );

        executor.execTransactionFromModule(
            avator,
            0,
            payload,
            Enum.Operation.DelegateCall
        );
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
        address transactionSender
    ) external view override {
        if (blockedTargets[to].exceptFromSender == transactionSender) {
            return;
        }

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
