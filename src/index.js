const { createAndFundWallets } = require('./walletSetup');
const { createJitoBundle } = require('./jitoBundle');
const { executeChainTransactions } = require('./chainTransaction');
const { main: buyTokens } = require('./jupiterBuy');

async function main() {
  try {
    // Step 1: Create and fund wallets
    const { primaryWallets, secondaryWallets, tertiaryWallets, tokenMint } = await createAndFundWallets();
    console.log('Wallets created and funded.');

    // Step 2: Create Jito bundle for transferring funds from primary to secondary wallets
    await createJitoBundle(primaryWallets, secondaryWallets, tokenMint);
    console.log('Jito bundle transactions completed.');

    // Step 3: Execute chain transactions from secondary to tertiary wallets
    await executeChainTransactions([secondaryWallets, tertiaryWallets], tokenMint);
    console.log('Chain transactions completed.');

    // Step 4: Buy tokens using Jupiter API
    await buyTokens();
    console.log('Token purchases completed.');

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Execute the main function
main().catch(console.error);