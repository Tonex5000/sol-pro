const { Transaction, SystemProgram, PublicKey, Connection } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { connection, createAndFundWallets } = require('./walletSetup');

async function transferAllFunds(fromWallet, toWallet, tokenMint) {
  const transactions = [];

  // Get token accounts
  const fromTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(fromWallet.publicKey);
  const toTokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(toWallet.publicKey);

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

async function executeChainTransactions(walletGroups, tokenMint) {
  for (let i = 0; i < walletGroups.length - 1; i++) {
    const fromWallets = walletGroups[i];
    const toWallets = walletGroups[i + 1];

    console.log(`Transferring funds from group ${String.fromCharCode(65 + i)} to group ${String.fromCharCode(66 + i)}`);

    for (let j = 0; j < fromWallets.length; j++) {
      const transactions = await transferAllFunds(fromWallets[j], toWallets[j], tokenMint);

      // Sign and send transactions
      transactions.forEach(tx => tx.sign(fromWallets[j]));

      try {
        const signatures = await Promise.all(transactions.map(tx => 
          connection.sendTransaction(tx, [fromWallets[j]])
        ));

        console.log(`Transactions for wallet ${j} submitted:`, signatures);

        await Promise.all(signatures.map(signature => 
          connection.confirmTransaction(signature)
        ));

        console.log(`Transactions for wallet ${j} confirmed`);
      } catch (error) {
        console.error(`Error in transactions for wallet ${j}:`, error);
      }
    }
  }
}

async function main() {
  const { secondaryWallets, tokenMint } = await createAndFundWallets();

  // Group secondary wallets
  const groupA = secondaryWallets.filter((_, index) => index % 4 === 0);
  const groupB = secondaryWallets.filter((_, index) => index % 4 === 1);
  const groupC = secondaryWallets.filter((_, index) => index % 4 === 2);
  const groupD = secondaryWallets.filter((_, index) => index % 4 === 3);

  // Execute chain transactions
  await executeChainTransactions([groupA, groupB, groupC, groupD], tokenMint);

  console.log('Chain transactions completed. All funds should now be in group D wallets.');
}

main().catch(console.error);

module.exports = { executeChainTransactions };