// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import "hardhat/console.sol";

contract Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

interface Guard {
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
    ) external view;

    function checkAfterExecution(bytes32, bool) external view;
}

contract TestAvatar {
    address public module;
    address public guard;
    event ExecTransaction(bool success);

    receive() external payable {}

    fallback() external {
        console.log("fallback in TestAvatar");
    }

    function enableModule(address _module) external {
        module = _module;
    }

    function setGuard(address _guard) external {
        guard = _guard;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) public payable returns (bool) {
        if (guard != address(0)) {
            Guard(guard).checkTransaction(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                signatures,
                msg.sender
            );
        }
        bool success;
        bytes memory response;
        (success, response) = to.call{value: value}(data);
        emit ExecTransaction(success);
        require(success, "Safe Tx reverted");
        return success;
    }

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(msg.sender == module, "Not authorized");
        // console.log("execTransactionFromModule called");
        if (operation == 1) {
            (success, ) = to.delegatecall(data);
        } else {
            (success, ) = to.call{value: value}(data);
        }
    }
}

contract TestExecutor {
    address public module;
    address payable public target;

    struct Transaction {
        address payable to;
        uint256 value;
        bytes data;
        uint8 operation;
    }

    Transaction queueData;

    function enableModule(address _module) external {
        module = _module;
    }

    function setTarget(address payable _target) external {
        target = _target;
    }

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(msg.sender == module, "Not authorized");
        queueData.to = to;
        queueData.value = value;
        queueData.data = data;
        queueData.operation = operation;
        return true;
    }

    function executeNextTx() public {
        exec(
            queueData.to,
            queueData.value,
            queueData.data,
            queueData.operation
        );
    }

    function exec(
        address payable to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) internal returns (bool success) {
        /// check if a transactioon guard is enabled.

        success = TestAvatar(target).execTransactionFromModule(
            to,
            value,
            data,
            uint8(operation)
        );

        return success;
    }
}
