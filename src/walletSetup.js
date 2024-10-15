const { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
require('dotenv').config();

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Function to create a wallet
async function createWallet() {
  const wallet = Keypair.generate();
  const airdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);
  return wallet;
}

// Function to create and mint token
async function createAndMintToken(authority) {
  const tokenMint = await Token.createMint(
    connection,
    authority,
    authority.publicKey,
    null,
    9,
    TOKEN_PROGRAM_ID
  );

  return tokenMint;
}

// Function to create token account and mint tokens
async function createTokenAccountAndMint(tokenMint, wallet, amount) {
  const tokenAccount = await tokenMint.getOrCreateAssociatedAccountInfo(
    wallet.publicKey
  );
  
  await tokenMint.mintTo(
    tokenAccount.address,
    wallet,
    [],
    amount
  );

  return tokenAccount;
}

// Function to create and fund wallets
async function createAndFundWallets() {
  const primaryWallets = [];
  const secondaryWallets = [];

  // Use prepared wallets for primary wallets
  const preparedWalletSecrets = process.env.PRIMARY_WALLET_SECRETS.split(',');
  for (const secret of preparedWalletSecrets) {
    const wallet = Keypair.fromSecretKey(Buffer.from(secret, 'base64'));
    primaryWallets.push(wallet);
  }

  // Create secondary wallets
  for (let i = 0; i < 20; i++) {  // Changed to 20 as per your previous request
    secondaryWallets.push(await createWallet());
  }

  // Create and mint devnet token
  const tokenAuthority = Keypair.generate();
  const tokenMint = await createAndMintToken(tokenAuthority);

  // Mint tokens to all wallets
  const mintAmount = 1000 * LAMPORTS_PER_SOL; // 1000 tokens
  for (const wallet of [...primaryWallets, ...secondaryWallets]) {
    await createTokenAccountAndMint(tokenMint, wallet, mintAmount);
  }

  return { primaryWallets, secondaryWallets, tokenMint: tokenMint.publicKey };
}

module.exports = { createAndFundWallets, connection };