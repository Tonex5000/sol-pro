const { Connection } = require('@solana/web3.js');
const { setupJupiter, purchaseTokens } = require('./jupiterFunctions'); 

async function initializeJupiter() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const jupiter = await setupJupiter(connection);
  return jupiter;
}