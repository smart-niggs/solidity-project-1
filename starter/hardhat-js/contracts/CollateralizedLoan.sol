// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

contract CollateralizedLoan {
    struct Loan {
        address payable borrower;
        address payable lender;
        uint collateralAmount;
        uint amount;
        uint interestRate;
        uint dueDate;
        bool isFunded;
        bool isRepaid;
    }

    mapping(uint => Loan) public loans;
    uint public nextLoanId;
    address payable private owner;

    event LoanRequested(
        uint id,
        address indexed borrower,
        uint collateralAmount,
        uint interestRate,
        uint dueDate
    );

    event LoanFunded(uint id, address indexed lender, uint amount);
    event LoanRepaid(
        uint id,
        uint amount,
        address indexed lender,
        address indexed borrower,
        uint amountRepaid
    );
    event CollateralClaimed(uint id, address lender, uint amount);

    modifier loanExists(uint loanId) {
        require(loans[loanId].collateralAmount > 0, "loan does not exist");
        _;
    }
    modifier loanNotFunded(uint _loanId) {
        require(loans[_loanId].isFunded == false, "loan already funded");
        _;
    }

    constructor() {
        owner = payable(msg.sender);
    }

    function depositCollateralAndRequestLoan(
        uint _interestRate,
        uint _duration
    ) external payable {
        require(msg.value > 0, "collateral must be greater than 0");

        uint loanAmount = msg.value;
        nextLoanId++;

        loans[nextLoanId] = Loan({
            borrower: payable(msg.sender),
            collateralAmount: loanAmount,
            amount: loanAmount,
            interestRate: _interestRate,
            dueDate: _duration + block.timestamp,
            isFunded: false,
            isRepaid: false,
            lender: payable(address(0))
        });

        emit LoanRequested(
            nextLoanId,
            msg.sender,
            loanAmount,
            _interestRate,
            _duration + block.timestamp
        );
    }

    function fundLoan(
        uint _loanId
    ) external payable loanExists(_loanId) loanNotFunded(_loanId) {
        Loan storage loan = loans[_loanId];

        require(
            msg.value == loan.amount,
            "amount must be equal to loan amount"
        );
        loans[_loanId].lender = payable(msg.sender);
        loan.borrower.transfer(msg.value);
        loan.isFunded = true;

        emit LoanFunded(_loanId, msg.sender, loan.amount);
    }

    function repayLoan(uint _loanId) external payable loanExists(_loanId) {
        Loan storage loan = loans[_loanId];

        require(loan.isFunded, "loan is not funded");
        require(loan.isRepaid != true, "loan is already repaid");
        uint totalRepaymentAmount = (loan.amount * (loan.interestRate + 100)) /
            100;

        require(
            msg.value == totalRepaymentAmount,
            string(
                abi.encodePacked(
                    "amount must be equal to repayment: ",
                    uintToString(totalRepaymentAmount)
                )
            )
        );

        loan.lender.transfer(totalRepaymentAmount);
        loan.borrower.transfer(loan.collateralAmount);

        loan.isRepaid = true;

        emit LoanRepaid(
            _loanId,
            loan.amount,
            loan.lender,
            loan.borrower,
            totalRepaymentAmount
        );
    }

    function claimCollateral(
        uint _loanId
    ) external payable loanExists(_loanId) {
        require(loans[_loanId].isFunded, "loan must be funded");
        require(loans[_loanId].isRepaid == false, "loan already repaid");
        require(
            loans[_loanId].lender == msg.sender,
            "Only lender can claimCollateral"
        );
        require(
            loans[_loanId].dueDate >= block.timestamp,
            "collateral can only be claimed after due date"
        );

        Loan storage loan = loans[_loanId];
        loan.lender.transfer(loan.collateralAmount);
        loan.isRepaid = true;

        emit CollateralClaimed(_loanId, loan.lender, loan.collateralAmount);
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }

    function logBalanceToConsole(string memory text) internal view {
        console.log(
            string(
                abi.encodePacked(
                    text,
                    ": balance: ",
                    uintToString(address(this).balance)
                )
            )
        );
    }

    // internal utility function to convert uint to string for logging
    function uintToString(uint v) internal pure returns (string memory) {
        if (v == 0) {
            return "0";
        }
        uint j = v;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (v != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(v - (v / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            v /= 10;
        }
        return string(bstr);
    }
}
