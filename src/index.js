const { createAndFundWallets } = require('./walletSetup');
const { createJitoBundle } = require('./jitoBundle');
const { executeChainTransaction } = require('./chainTransaction');
const { performTokenSwap } = require('./jupiterSwap');
const { PublicKey } = require('@solana/web3.js');

async function main() {
  try {
    // Step 1: Create and fund wallets
    const { primaryWallets, secondaryWallets, tokenMint } = await createAndFundWallets();
    console.log('Wallets created and funded');
    console.log('Primary Wallets:', primaryWallets.map(w => w.publicKey.toBase58()));
    console.log('Secondary Wallets:', secondaryWallets.map(w => w.publicKey.toBase58()));

    // Step 2: Execute Jito bundle transactions
    await createJitoBundle(primaryWallets, secondaryWallets);
    console.log('Jito bundle transactions completed');

    // Step 3: Execute chain transaction for sets of secondary wallets
    for (let i = 0; i < secondaryWallets.length; i += 4) {
      const walletA = secondaryWallets[i];
      const walletB = secondaryWallets[i + 1];
      const walletC = secondaryWallets[i + 2];
      const walletD = secondaryWallets[i + 3];
      if (walletA && walletB && walletC && walletD) {
        await executeChainTransaction(walletA, walletB, walletC, walletD, tokenMint);
        console.log(`Chain transaction completed for set ${i / 4 + 1}`);
        
        // Step 4: Perform Jupiter swap for wallet D
        const USDC_DEVNET = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
        await performTokenSwap(walletD, tokenMint, USDC_DEVNET, 100 * 1e9); // Swap 100 tokens
        console.log(`Jupiter swap completed for set ${i / 4 + 1}`);
      }
    }

    console.log('All operations completed successfully');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();