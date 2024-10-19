const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fetch = require('node-fetch');
const { connection, createWallet } = require('./walletSetup');
require('dotenv').config();

// Assuming this is the mint address of the token we want to buy
const TARGET_TOKEN_MINT = new PublicKey(process.env.OUTPUT_MINT_ADDRESS);

async function createEWallets(count) {
  const eWallets = [];
  for (let i = 0; i < count; i++) {
    eWallets.push(await createWallet());
  }
  return eWallets;
}

async function transferHalfSol(fromWallet, toWallet) {
  const balance = await connection.getBalance(fromWallet.publicKey);
  const transferAmount = Math.floor(balance / 2);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: toWallet.publicKey,
      lamports: transferAmount,
    })
  );

  return transaction; // Return transaction instead of sending it immediately
}

async function buyTokensWithJupiterAPI(wallet, amountInLamports, inputMint) {
  const routes = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${TARGET_TOKEN_MINT.toBase58()}&amount=${amountInLamports}&slippageBps=50`)
    .then(response => response.json());

  if (!routes.data.length) {
    console.error('No routes found');
    return;
  }

  const bestRoute = routes.data[0];

  const { swapTransaction } = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      route: bestRoute,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapUnwrapSOL: true
    })
  }).then(response => response.json());

  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  return Transaction.from(swapTransactionBuf); // Return the transaction instead of sending it immediately
}

async function transferAllFunds(fromWallet, toWallet, tokenMint) {
  const transactions = [];

  // Transfer all SOL
  const solBalance = await connection.getBalance(fromWallet.publicKey);
  const solTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: toWallet.publicKey,
      lamports: solBalance - 5000, // Leave some for fees
    })
  );
  
  transactions.push(solTransaction);

  // Transfer all tokens
  const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection, fromWallet, tokenMint, fromWallet.publicKey)
  const toTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(connection, fromWallet, tokenMint, toWallet.publicKey)
  
  const tokenBalance = await tokenMint.getAccountInfo(fromTokenAccount.address);
  
  const tokenTransaction = new Transaction().add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet.publicKey,
      [],
      tokenBalance.amount.toNumber()
    )
  );
  
  transactions.push(tokenTransaction);

  return transactions; // Return all transactions instead of sending them immediately
}

async function createJitoBundle(transactions, wallet) {
  // Sign transactions with the respective wallet
  transactions.forEach(tx => tx.sign(wallet));

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

async function main() {
  // Assuming we have access to D wallets and token mint from previous steps
  const { secondaryWallets, tokenMint } = require('./chainTransaction');
  
  const dWallets = secondaryWallets.filter((_, index) => index % 4 === 3);

  // Create E wallets
  const eWallets = await createEWallets(dWallets.length);

  for (let i = 0; i < dWallets.length; i++) {
    const transactionsToSend = [];

    // Transfer half SOL from D to E
    transactionsToSend.push(await transferHalfSol(dWallets[i], eWallets[i]));

    // Buy tokens using Jupiter API
    const eWalletBalance = await connection.getBalance(eWallets[i].publicKey);
    transactionsToSend.push(await buyTokensWithJupiterAPI(eWallets[i], eWalletBalance, tokenMint.toBase58()));

    // Transfer remaining funds from D to E
    transactionsToSend.push(...await transferAllFunds(dWallets[i], eWallets[i], tokenMint));
    
    // Flatten the array and send as a Jito bundle
    await createJitoBundle(transactionsToSend.flat(), dWallets[i]);
    
    console.log(`Completed operations for wallet ${dWallets[i].publicKey.toBase58()}`);
  }

  console.log('All operations completed. E wallets now have all funds and newly purchased tokens.');
}

main().catch(console.error);

module.exports = { main };