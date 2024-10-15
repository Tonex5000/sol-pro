const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { Jupiter } = require('@jup-ag/core');
require('dotenv').config()

async function setupJupiter(connection) {
  const jupiter = await Jupiter.load({
    connection,
    cluster: 'devnet',
    user: walletD.publicKey
  });
  return jupiter;
}

async function purchaseTokens(jupiter, walletD, outputTokenMint, amountInSol) {
  const connection = jupiter.connection;
  const inputMint = new PublicKey(process.env.INPUT_MINT_ADDRESS);
  const outputMint = new PublicKey(outputTokenMint);

  const routes = await jupiter.computeRoutes({
    inputMint,
    outputMint,
    amount: amountInSol,
    slippageBps: 50, // 0.5% slippage
  });

  const bestRoute = routes.routesInfos[0];
  
  const { transactions } = await jupiter.exchange({
    routeInfo: bestRoute,
  });

  const { transaction } = transactions;
  transaction.feePayer = walletD.publicKey;
  transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

  // Sign the transaction
  transaction.sign(walletD);

  // Send and confirm the transaction
  const txid = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(txid, 'confirmed');
  
  console.log('Token purchase completed. Transaction ID:', txid);

  // Fetch the balance of the purchased token
  const tokenAccount = await connection.getTokenAccountsByOwner(walletD.publicKey, { mint: outputMint });
  if (tokenAccount.value.length > 0) {
    const balance = await connection.getTokenAccountBalance(tokenAccount.value[0].pubkey);
    console.log(`Purchased token balance: ${balance.value.uiAmount}`);
  } else {
    console.log('No token account found for the purchased token');
  }
}

module.exports = { setupJupiter, purchaseTokens };