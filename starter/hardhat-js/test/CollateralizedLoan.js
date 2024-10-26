// Importing necessary modules and functions from Hardhat and Chai for testing
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Describing a test suite for the CollateralizedLoan contract
describe("CollateralizedLoan", function () {
  const loanAmount = ethers.parseEther("1.5")
  const interestRate = 10;
  const loanDuration = 10 * 24 * 3600 * 1000;
  const repaymentAmount = ethers.parseEther(((1.5 * (interestRate + 100)) /
    100).toString());


  // A fixture to deploy the contract before each test. This helps in reducing code repetition.
  async function deployCollateralizedLoanFixture() {

    const [owner, borrower, lender] = await ethers.getSigners();
    const CollateralizedLoan = await ethers.getContractFactory(
      "CollateralizedLoan"
    );
    const collateralizedLoan = await CollateralizedLoan.deploy();

    return { collateralizedLoan, owner, borrower, lender };
  }


  describe("Loan Request", function () {
    it("Should let a borrower deposit collateral and request a loan", async function () {

      const { collateralizedLoan, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      await collateralizedLoan
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, loanDuration, { value: loanAmount })

      const loan = await collateralizedLoan.loans(1);

      expect(loan.borrower).to.equal(borrower);
      expect(loan.interestRate).to.equal(interestRate);
      expect(loan.collateralAmount).to.equal(loanAmount);
      expect(loan.isFunded).to.equal(false);
    });
  });


  // Test suite for funding a loan
  describe("Funding a Loan", function () {
    it("Allows a lender to fund a requested loan", async function () {

      const { collateralizedLoan, lender, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // request a loan
      await collateralizedLoan
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, loanDuration, { value: loanAmount });

      // fund loan
      await expect(await collateralizedLoan
        .connect(lender)
        .fundLoan(1, { value: loanAmount }))
        .to.emit(collateralizedLoan, "LoanFunded")
        .withArgs(1, lender, loanAmount)

      const loan = await collateralizedLoan.loans(1);

      expect(loan.lender).to.equal(lender);
      expect(loan.isFunded).to.equal(true);
    })
  });

  // Test suite for repaying a loan
  describe("Repaying a Loan", function () {
    it("Enables the borrower to repay the loan fully", async function () {

      const { collateralizedLoan, lender, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // request a loan
      await collateralizedLoan
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, loanDuration, { value: loanAmount });

      // fund loan
      await collateralizedLoan
        .connect(lender)
        .fundLoan(1, { value: loanAmount })

      // repay loan
      await expect(await collateralizedLoan
        .connect(borrower)
        .repayLoan(1, { value: repaymentAmount }))
        .to.emit(collateralizedLoan, "LoanRepaid")
        .withArgs(1, loanAmount, lender, borrower, repaymentAmount);

      const loan = await collateralizedLoan.loans(1);

      expect(loan.borrower).to.equal(borrower);
      expect(loan.lender).to.equal(lender);
      expect(loan.isFunded).to.equal(true);
      expect(loan.isRepaid).to.equal(true);
    })
  });


  // Test suite for claiming collateral
  describe("Claiming Collateral", function () {
    it("Permits the lender to claim collateral if the loan isn't repaid on time", async function () {
      // use a timeStamp in the past to simulate loan tenure exceeded
      const timeStampInThePast = Date.now() - (10 * 3600)

      const { collateralizedLoan, lender, borrower } = await loadFixture(
        deployCollateralizedLoanFixture
      );

      // request a loan
      await collateralizedLoan
        .connect(borrower)
        .depositCollateralAndRequestLoan(interestRate, timeStampInThePast, { value: loanAmount });

      // fund loan
      await collateralizedLoan
        .connect(lender)
        .fundLoan(1, { value: loanAmount })


      let loan = await collateralizedLoan.loans(1);
      expect(loan.borrower).to.equal(borrower);
      expect(loan.lender).to.equal(lender);
      expect(loan.isFunded).to.equal(true);
      expect(loan.isRepaid).to.equal(false);

      // repay loan
      await expect(await collateralizedLoan
        .connect(lender)
        .claimCollateral(1))
        .to.emit(collateralizedLoan, "CollateralClaimed")
        .withArgs(1, lender, loanAmount);

      loan = await collateralizedLoan.loans(1);
      expect(loan.isRepaid).to.equal(true);
    });
  });
})
