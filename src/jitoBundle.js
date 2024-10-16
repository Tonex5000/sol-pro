const { Transaction, SystemProgram, PublicKey, Connection } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { connection, createAndFundWallets } = require('./walletSetup');
const fetch = require('node-fetch');

async function transferFunds(primaryWallet, secondaryWallets, tokenMint) {
  const transactions = [];

  // Get token accounts
  const primaryTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(primaryWallet.publicKey);
  const tokenBalance = await tokenMint.getAccountInfo(primaryTokenAccount.address);
  
  // Calculate amounts to transfer
  const balance = await connection.getBalance(primaryWallet.publicKey);
  const solPerSecondary = Math.floor((balance - 5000) / secondaryWallets.length); // Leave some for transaction fees
  const tokenPerSecondary = Math.floor(tokenBalance.amount.toNumber() / secondaryWallets.length);

  // Create SOL transfer transactions
  for (const secondaryWallet of secondaryWallets) {
    const solTransfer = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: primaryWallet.publicKey,
        toPubkey: secondaryWallet.publicKey,
        lamports: solPerSecondary,
      })
    );
    transactions.push(solTransfer);

    // Create token transfer transactions
    const secondaryTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(secondaryWallet.publicKey);
    const tokenTransfer = new Transaction().add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        primaryTokenAccount.address,
        secondaryTokenAccount.address,
        primaryWallet.publicKey,
        [],
        tokenPerSecondary
      )
    );
    transactions.push(tokenTransfer);
  }

  return transactions;
}

async function createJitoBundle(primaryWallets, secondaryWallets, tokenMint) {
  const allTransactions = [];

  // Create transactions for transferring from primary to secondary wallets
  for (let i = 0; i < primaryWallets.length; i++) {
    const primaryWallet = primaryWallets[i];
    const currentSecondaryWallets = secondaryWallets[primaryWallet.publicKey.toBase58()];

    const transactions = await transferFunds(primaryWallet, currentSecondaryWallets, tokenMint);
    allTransactions.push(...transactions);
  }

  // Serialize all transactions
  const serializedTransactions = allTransactions.map(tx => tx.serializeMessage());

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

async function main() {
  const { primaryWallets, secondaryWallets, tokenMint } = await createAndFundWallets();
  
  // Set connection to devnet
  connection.rpcEndpoint = "https://api.devnet.solana.com";
  
  await createJitoBundle(primaryWallets, secondaryWallets, tokenMint);
}

main().catch(console.error);

module.exports = { createJitoBundle };