const { Transaction, SystemProgram, PublicKey, Connection } = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const { connection, createAndFundWallets } = require('./walletSetup');
const bs58 = require('bs58')
const fetch = require('node-fetch');

function splitIntoBundles(transactions, maxSize) {
  const bundles = [];
  let currentBundle = []; // Change const to let

  for (const transaction of transactions) {
    if (currentBundle.length < maxSize) { // Use currentBundle.length to check size
     currentBundle.push(transaction);
    } else {
     bundles.push(currentBundle);
     currentBundle = [transaction]; // Reset currentBundle with the new transaction
    }
  }

  // Add any remaining transactions to bundles
  if (currentBundle.length > 0) {
    bundles.push(currentBundle);
  }

  return bundles;
}

async function transferFunds(primaryWallet, secondaryWallets, tokenMint) {
  const transactions = [];
  
  // Get token accounts
  //const primaryAddress = bs58.encode(primaryWallet);
  const primaryTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection, primaryWallet, tokenMint, primaryWallet.publicKey);
  const tokenBalance = await connection.getTokenAccountBalance(primaryTokenAccount.address)
  
  // Calculate amounts to transfer
  const balance = await connection.getBalance(primaryWallet.publicKey);
  const solPerSecondary = Math.floor((balance - 5000) / secondaryWallets.length); // Leave some for transaction fees
  const tokenPerSecondary = Math.floor(tokenBalance.value.amount / secondaryWallets.length);

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
    const secondaryTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection,primaryWallet, tokenMint, secondaryWallet.publicKey);
    
    const tokenTransfer = new Transaction().add(
      splToken.createTransferInstruction(
        primaryTokenAccount.address,
        secondaryTokenAccount.address,
        primaryWallet.publicKey,
        tokenPerSecondary,
        [],
        splToken.TOKEN_PROGRAM_ID
      )
    );
    transactions.push(tokenTransfer);
  }

  return transactions;
}

async function createJitoBundle(primaryWallets, secondaryWallets, tokenMint) {
  const allTransactions = [];

  const {blockhash} = await connection.getLatestBlockhash('finalized')

  // Create transactions for transferring from primary to secondary wallets
  for (let i = 0; i < primaryWallets.length; i++) {
    const primaryWallet = primaryWallets[i];
    const currentSecondaryWallets = secondaryWallets[primaryWallet.publicKey.toBase58()];

    const transactions = await transferFunds(primaryWallet, currentSecondaryWallets, tokenMint);

    
    transactions.forEach(tx => {
      tx.recentBlockhash = blockhash;
      tx.feePayer = primaryWallet.publicKey;
      tx.sign(primaryWallet);
    })

    allTransactions.push(...transactions);
  }

  const transactionBundles = splitIntoBundles(allTransactions, 5);

  for(const bundle of transactionBundles){
  console.log(bundle)
  const serializedTransactions = bundle.map(tx => tx.serializeMessage());
  console.log(serializedTransactions)

  try {
    const response = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [serializedTransactions.map(tx => bs58.encode(tx)), { tip: { lamports: 1000 } }],
        bundleOnly: true // Important for Jito bundles
      })
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Error sending bundle: ${result.error.message}`);
    }

    console.log('Bundle submitted successfully:', result.result);


  } catch (error) {
    console.error('Error submitting bundle:', error);
  }
 }
}

async function main() {
  const { primaryWallets, secondaryWallets, tokenMint } = await createAndFundWallets();

  connection.rpcEndpoint = "https://api.devnet.solana.com"; 
  
  await createJitoBundle(primaryWallets, secondaryWallets, tokenMint);
}

main().catch(console.error);

module.exports = { createJitoBundle };