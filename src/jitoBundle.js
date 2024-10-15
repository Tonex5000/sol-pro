const { Transaction, SystemProgram, PublicKey, Connection } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { connection, createAndFundWallets } = require('./walletSetup');

async function transferAllFunds(primaryWallet, secondaryWalletA, tokenMint) {
  const transactions = [];

  // Get token accounts
  const primaryTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(primaryWallet.publicKey);
  const secondaryTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(secondaryWalletA.publicKey);

  // Transfer all SOL
  const balance = await connection.getBalance(primaryWallet.publicKey);
  const solTransfer = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: primaryWallet.publicKey,
      toPubkey: secondaryWalletA.publicKey,
      lamports: balance - 5000 // Leave some for transaction fees
    })
  );
  transactions.push(solTransfer);

  // Transfer all tokens
  const tokenBalance = await tokenMint.getAccountInfo(primaryTokenAccount.address);
  const tokenTransfer = new Transaction().add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      primaryTokenAccount.address,
      secondaryTokenAccount.address,
      primaryWallet.publicKey,
      [],
      tokenBalance.amount.toNumber()
    )
  );
  transactions.push(tokenTransfer);

  return transactions;
}

async function createJitoBundle(primaryWallets, secondaryWallets, tokenMint) {
  const allTransactions = [];
  
  // Create transactions for transferring from primary to secondary wallets
  for (let i = 0; i < primaryWallets.length; i++) {
    const primaryWallet = primaryWallets[i];
    const secondaryWalletA = secondaryWallets[i * 4]; // A is the first of every 4 secondary wallets

    const transactions = await transferAllFunds(primaryWallet, secondaryWalletA, tokenMint);
    allTransactions.push(...transactions);
  }

  // Sign all transactions
  allTransactions.forEach((tx, index) => {
    tx.sign(primaryWallets[Math.floor(index / 2)]); // Each primary wallet signs its 2 transactions
  });

  try {
    // Submit transactions in parallel
    const signaturePromises = allTransactions.map((tx, index) => 
      connection.sendTransaction(tx, [primaryWallets[Math.floor(index / 2)]])
    );
    const signatures = await Promise.all(signaturePromises);
    
    console.log('All transactions submitted successfully:', signatures);
    
    // Wait for confirmations
    const confirmationPromises = signatures.map(signature => 
      connection.confirmTransaction(signature)
    );
    await Promise.all(confirmationPromises);
    
    console.log('All transactions confirmed');
  } catch (error) {
    console.error('Error submitting transactions:', error);
  }
}

async function main() {
  const { primaryWallets, secondaryWallets, tokenMint } = await createAndFundWallets();
  await createJitoBundle(primaryWallets, secondaryWallets, tokenMint);
}

main().catch(console.error);

module.exports = { createJitoBundle };