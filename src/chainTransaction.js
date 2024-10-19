const { Transaction, SystemProgram, PublicKey, Connection } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const splToken = require('@solana/spl-token')
const fetch = require('node-fetch');
const { connection, createAndFundWallets } = require('./walletSetup');

async function transferAllFunds(fromWallet, toWallet, tokenMint) {
  const transactions = [];

  // Get token accounts
  const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection, fromWallet, tokenMint, fromWallet.publicKey)
  const toTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection, fromWallet, tokenMint, toWallet.publicKey)

  // Transfer all SOL
  const balance = await connection.getBalance(fromWallet.publicKey);
  const solTransfer = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: toWallet.publicKey,
      lamports: balance - 5000 // Leave some for transaction fees
    })
  );
  transactions.push(solTransfer);

  // Transfer all tokens
  const tokenBalance = await tokenMint.getAccountInfo(fromTokenAccount.address);
  const tokenTransfer = new Transaction().add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet.publicKey,
      [],
      tokenBalance.amount.toNumber()
    )
  );
  transactions.push(tokenTransfer);

  return transactions;
}

async function createJitoBundle(transactions, primaryWallet) {
  // Serialize all transactions
  const serializedTransactions = transactions.map(tx => tx.serializeMessage());

  try {
    // Send the bundle to Jito with a tip
    const response = await fetch('https://devnet.block-engine.jito.wtf/api/v1/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [serializedTransactions.map(tx => Buffer.from(tx).toString('base64')), { tip: { lamports: 1000 } }],
        bundleOnly: true // Important for Jito bundles
      })
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Error sending bundle: ${result.error.message}`);
    }

    console.log('Bundle submitted successfully:', result.result);
    
    // Optionally wait for confirmation here if needed

  } catch (error) {
    console.error('Error submitting bundle:', error);
  }
}

async function executeChainTransactions(walletGroups, tokenMint) {
  for (let i = 0; i < walletGroups.length - 1; i++) {
    const fromWallets = walletGroups[i];
    const toWallets = walletGroups[i + 1];

    console.log(`Transferring funds from group ${String.fromCharCode(65 + i)} to group ${String.fromCharCode(66 + i)}`);

    for (let j = 0; j < fromWallets.length; j++) {
      const transactions = await transferAllFunds(fromWallets[j], toWallets[j], tokenMint);

      // Sign transactions with the respective wallet
      transactions.forEach(tx => tx.sign(fromWallets[j]));

      // Create a Jito bundle for the current wallet's transactions
      await createJitoBundle(transactions, fromWallets[j]);
      
      console.log(`Transactions for wallet ${j} submitted as a bundle.`);
    }
  }
}

async function main() {
  const { secondaryWallets, tokenMint } = await createAndFundWallets();

  // Group secondary wallets into groups of three for each primary wallet
  const groupsOfSecondary = [];

  try{
    for (let i = 0; i < secondaryWallets.length; i += 3) {
      groupsOfSecondary.push(secondaryWallets.slice(i, i + 3));
    }
  
    // Create tertiary wallets for each secondary wallet group
    const groupsOfTertiary = groupsOfSecondary.map(group => {
      return group.flatMap(wallet => createChildWallets(3)); // Create three tertiary wallets for each secondary wallet
    });
  
    // Execute chain transactions from secondary wallets to tertiary wallets
    await executeChainTransactions([groupsOfSecondary.flat(), groupsOfTertiary.flat()], tokenMint);
  
    console.log('Chain transactions completed. All funds should now be in the tertiary wallets.');
  }catch(error){
    console.error("Error on chain Transaction: ", error)
  }
  

}

main().catch(console.error);

module.exports = { executeChainTransactions };