const assert = require('assert');
const { Connection, PublicKey } = require('@solana/web3.js');
const { createAndFundWallets } = require('./walletSetup');
const { createJitoBundle } = require('./jitoBundle');
const { executeChainTransactions } = require('./chainTransaction');
const { main: executeJupiterBuy } = require('./jupiterBuy');

// Mock connection for testing
const mockConnection = {
  getBalance: async () => 1000000000,
  sendTransaction: async () => 'mock_signature',
  confirmTransaction: async () => true,
};

async function runTests() {
  console.log('Running tests...');

  // Test wallet setup
  try {
    const { primaryWallets, secondaryWallets, tokenMint } = await createAndFundWallets(mockConnection);
    assert(primaryWallets.length > 0, 'Primary wallets should be created');
    assert(secondaryWallets.length > 0, 'Secondary wallets should be created');
    assert(tokenMint instanceof PublicKey, 'Token mint should be a PublicKey');
    console.log('Wallet setup test passed');
  } catch (error) {
    console.error('Wallet setup test failed:', error);
  }

  // Test Jito bundle creation
  try {
    const result = await createJitoBundle([], [], new PublicKey('11111111111111111111111111111111'));
    assert(result !== undefined, 'Jito bundle creation should return a result');
    console.log('Jito bundle test passed');
  } catch (error) {
    console.error('Jito bundle test failed:', error);
  }

  // Test chain transactions
  try {
    const result = await executeChainTransactions([[], [], [], []], new PublicKey('11111111111111111111111111111111'));
    assert(result !== undefined, 'Chain transactions should complete');
    console.log('Chain transactions test passed');
  } catch (error) {
    console.error('Chain transactions test failed:', error);
  }

  // Test Jupiter buy
  try {
    const result = await executeJupiterBuy();
    assert(result !== undefined, 'Jupiter buy should complete');
    console.log('Jupiter buy test passed');
  } catch (error) {
    console.error('Jupiter buy test failed:', error);
  }

  console.log('All tests completed');
}

runTests().catch(console.error);