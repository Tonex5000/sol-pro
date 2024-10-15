const { createAndFundWallets } = require('./walletSetup');
const { createJitoBundle } = require('./jitoBundle');
const { executeChainTransactions } = require('./chainTransaction');
const { main: executeJupiterBuy } = require('./jupiterBuy');

async function runEntireProcess() {
  console.log('Starting the entire process...');

  try {
    // Step 1: Create and fund wallets
    console.log('Step 1: Creating and funding wallets...');
    const { primaryWallets, secondaryWallets, tokenMint } = await createAndFundWallets();
    console.log('Wallets created and funded successfully.');

    // Step 2: Transfer funds from primary to secondary A wallets using Jito bundle
    console.log('Step 2: Transferring funds from primary to secondary A wallets...');
    await createJitoBundle(primaryWallets, secondaryWallets, tokenMint);
    console.log('Funds transferred to secondary A wallets successfully.');

    // Step 3: Execute chain transactions (A -> B -> C -> D)
    console.log('Step 3: Executing chain transactions...');
    await executeChainTransactions([
      secondaryWallets.filter((_, index) => index % 4 === 0), // A wallets
      secondaryWallets.filter((_, index) => index % 4 === 1), // B wallets
      secondaryWallets.filter((_, index) => index % 4 === 2), // C wallets
      secondaryWallets.filter((_, index) => index % 4 === 3)  // D wallets
    ], tokenMint);
    console.log('Chain transactions completed successfully.');

    // Step 4: Execute Jupiter buy and final transfers
    console.log('Step 4: Executing Jupiter buy and final transfers...');
    await executeJupiterBuy();
    console.log('Jupiter buy and final transfers completed successfully.');

    console.log('Entire process completed successfully!');
  } catch (error) {
    console.error('An error occurred during the process:', error);
  }
}

runEntireProcess().then(() => {
  console.log('Process finished. Exiting...');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error occurred:', error);
  process.exit(1);
});