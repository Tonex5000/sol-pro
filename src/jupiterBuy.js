const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fetch = require('node-fetch');
const { connection, createWallet } = require('./walletSetup');
require('dotenv').config();

// Assuming this is the mint address of the token we want to buy
const TARGET_TOKEN_MINT = new PublicKey(process.env.INPUT_MINT_ADDRESS);

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

  const signature = await connection.sendTransaction(transaction, [fromWallet]);
  await connection.confirmTransaction(signature);
  console.log(`Transferred ${transferAmount} lamports from D to E wallet`);
}

async function buyTokensWithJupiterAPI(wallet, amountInLamports) {
  const routes = await fetch(`https://quote-api.jup.ag/v4/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${TARGET_TOKEN_MINT.toBase58()}&amount=${amountInLamports}&slippageBps=50`)
    .then(response => response.json());

  if (!routes.data.length) {
    console.error('No routes found');
    return;
  }

  const bestRoute = routes.data[0];
  
  const { swapTransaction } = await fetch('https://quote-api.jup.ag/v4/swap', {
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
  const transaction = Transaction.from(swapTransactionBuf);
  
  const txid = await connection.sendTransaction(transaction, [wallet]);
  console.log('Jupiter swap transaction sent:', txid);
  
  await connection.confirmTransaction(txid);
  console.log('Jupiter swap confirmed');
}

async function transferAllFunds(fromWallet, toWallet, tokenMint) {
  // Transfer all SOL
  const solBalance = await connection.getBalance(fromWallet.publicKey);
  const solTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromWallet.publicKey,
      toPubkey: toWallet.publicKey,
      lamports: solBalance - 5000, // Leave some for fees
    })
  );
  await connection.sendTransaction(solTransaction, [fromWallet]);

  // Transfer all tokens
  const fromTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(fromWallet.publicKey);
  const toTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(toWallet.publicKey);
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
  await connection.sendTransaction(tokenTransaction, [fromWallet]);

  console.log('Transferred all funds from D to E wallet');
}

async function main() {
  // Assuming we have access to D wallets and token mint from previous steps
  const { secondaryWallets, tokenMint } = require('./chainTransaction');
  const dWallets = secondaryWallets.filter((_, index) => index % 4 === 3);

  // Create E wallets
  const eWallets = await createEWallets(dWallets.length);

  for (let i = 0; i < dWallets.length; i++) {
    // Transfer half SOL from D to E
    await transferHalfSol(dWallets[i], eWallets[i]);

    // Buy tokens using Jupiter API
    const eWalletBalance = await connection.getBalance(eWallets[i].publicKey);
    await buyTokensWithJupiterAPI(eWallets[i], eWalletBalance);

    // Transfer remaining funds from D to E
    await transferAllFunds(dWallets[i], eWallets[i], tokenMint);
  }

  console.log('All operations completed. E wallets now have all funds and newly purchased tokens.');
}

main().catch(console.error);

module.exports = { main };