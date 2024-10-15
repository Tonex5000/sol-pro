const { Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } = require('@solana/web3.js');
const { connection } = require('./walletSetup');

async function createJitoBundle(primaryWallets, secondaryWallets) {
  const transactions = [];
  
  // Create transactions for transferring from primary to secondary wallets
  primaryWallets.forEach((primaryWallet, index) => {
    const start = index * 4;
    const end = Math.min(start + 4, secondaryWallets.length);
    for (let i = start; i < end; i++) {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: primaryWallet.publicKey,
          toPubkey: secondaryWallets[i].publicKey,
          lamports: LAMPORTS_PER_SOL / 10
        })
      );
      transactions.push(transaction);
    }
  });

  // Sign all transactions
  transactions.forEach((tx, index) => {
    tx.sign(primaryWallets[Math.floor(index / 4)]);
  });

  try {
    // Submit transactions in parallel
    const signaturePromises = transactions.map((tx, index) => 
      connection.sendTransaction(tx, [primaryWallets[Math.floor(index / 4)]])
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

module.exports = { createJitoBundle };