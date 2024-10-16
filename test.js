const { createAndFundWallets } = require('./walletSetup');
const { createJitoBundle } = require('./jitoBundle');
const { executeChainTransactions } = require('./chainTransaction');
const { main: buyTokens } = require('./jupiterBuy');

describe('Solana Wallet Management and Transactions', () => {
  let primaryWallets;
  let secondaryWallets;
  let tokenMint;

  beforeAll(async () => {
    // Step 1: Create and fund wallets
    const result = await createAndFundWallets();
    primaryWallets = result.primaryWallets;
    secondaryWallets = result.secondaryWallets;
    tokenMint = result.tokenMint;
  });

  test('should create and fund wallets', async () => {
    expect(primaryWallets.length).toBeGreaterThan(0);
    expect(secondaryWallets.length).toBeGreaterThan(0);
    expect(tokenMint).toBeDefined();
  });

  test('should create Jito bundle', async () => {
    const bundleResult = await createJitoBundle(primaryWallets, secondaryWallets, tokenMint);
    expect(bundleResult).toBeDefined(); // Adjust this based on what the function returns
  });

  test('should execute chain transactions', async () => {
    const tertiaryWallets = secondaryWallets.map(wallet => createChildWallets(3)); // Create dummy tertiary wallets for testing
    const result = await executeChainTransactions([secondaryWallets, tertiaryWallets], tokenMint);
    expect(result).toBeDefined(); // Adjust this based on what the function returns
  });

  test('should buy tokens using Jupiter API', async () => {
    const eWallets = await createEWallets(3); // Create dummy e-wallets for testing
    const eWalletBalance = await connection.getBalance(eWallets[0].publicKey);
    
    // Ensure there's enough balance to buy tokens
    if (eWalletBalance > 0) {
      await buyTokens(eWallets[0], eWalletBalance);
      // Add assertions to check if tokens were bought successfully
      // This might require checking the token account balance after the purchase.
    }
  });
});