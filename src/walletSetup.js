const { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
require('dotenv').config();

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Function to airdrop SOL to a wallet
async function airdropSol(wallet) {
  const airdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);
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

// Function to create child wallets
function createChildWallets(count) {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    wallets.push(Keypair.generate());
  }
  return wallets;
}

// Function to create and fund wallets
async function createAndFundWallets() {
  const primaryWallets = [];
  const secondaryWallets = {};
  const tertiaryWallets = {};

  // Use prepared wallets for primary wallets
  const preparedWalletSecrets = process.env.PRIMARY_WALLET_SECRETS.split(',');
  
  for (const secret of preparedWalletSecrets) {
    const wallet = Keypair.fromSecretKey(Buffer.from(secret, 'base64'));
    
    primaryWallets.push(wallet);
    
    // Airdrop 1 SOL to each primary wallet
    await airdropSol(wallet);

    // Create secondary wallets for each primary wallet
    secondaryWallets[wallet.publicKey.toBase58()] = createChildWallets(3);

    // Create tertiary wallets for each secondary wallet
    tertiaryWallets[wallet.publicKey.toBase58()] = {};
    
    for (const secondaryWallet of secondaryWallets[wallet.publicKey.toBase58()]) {
      tertiaryWallets[wallet.publicKey.toBase58()][secondaryWallet.publicKey.toBase58()] = createChildWallets(3);
    }
  }

  // Create and mint devnet token
  const tokenAuthority = Keypair.generate();
  const tokenMint = await createAndMintToken(tokenAuthority);

  // Mint tokens only to primary wallets
  const mintAmount = 1000 * (10 ** 9); // Adjusted for decimal places (1000 tokens with precision of 9)
  
  for (const wallet of primaryWallets) {
    await createTokenAccountAndMint(tokenMint, wallet, mintAmount);
  }

  return { 
    primaryWallets, 
    secondaryWallets, 
    tertiaryWallets, 
    tokenMint: tokenMint.publicKey 
  };
}

module.exports = { createAndFundWallets, connection };