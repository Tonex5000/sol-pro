const solanaWeb3 = require("@solana/web3.js")
const splToken = require("@solana/spl-token")
require('dotenv').config()
const bs58 = require('bs58')



const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed')
const authority = solanaWeb3.Keypair.generate();

async function createAndMintToken(authority) {
  const mint = await splToken.createMint(
    connection,
    authority,
    authority.publicKey,
    null,
    9,
    undefined,
    {},
    splToken.TOKEN_PROGRAM_ID
  )

  return {mint, mintAuthority: authority};
}

async function createTokenAccountAndMint(tokenMint, wallet, mintAuthority) {
  console.log("In it")
  console.log(wallet.publicKey)
  console.log(tokenMint)
  const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    tokenMint,
    wallet.publicKey
  );

  console.log("deeper")
 
  await splToken.mintTo(
    connection,
    wallet,
    tokenMint,
    tokenAccount.address,
    mintAuthority,
    1000000000
  );

  return tokenAccount;
}

// Function to create child wallets
function createChildWallets(count) {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    wallets.push(solanaWeb3.Keypair.generate());
  }
  return wallets;
}

async function createAndFundWallets() {
  const primaryWallets = [];
  const secondaryWallets = {};
  const tertiaryWallets = {};

  // Use prepared wallets for primary wallets
  const preparedWalletSecrets = process.env.PRIMARY_WALLET_SECRETS.split(',');

 for(const secret of preparedWalletSecrets) {
   let secretKey;
   try{
    secretKey = bs58.decode(secret.trim());
    console.log(secretKey)
   }catch(error){
    console.error(`Failed to decode secret key: ${error.message}`)
    continue;
   }
   if(secretKey.length !== 64){
    console.error(`Invalid secret key length: ${secretKey.length}`)
    continue;
   }
   const wallet = solanaWeb3.Keypair.fromSecretKey(secretKey);
   primaryWallets.push(wallet)

   // Airdrop 1 SOL to each primary wallet
   //await airdropSol(wallet);

   // Create secondary wallets for each primary wallet
   secondaryWallets[wallet.publicKey.toBase58()] = createChildWallets(3);

   // Create tertiary wallets for each secondary wallet
   tertiaryWallets[wallet.publicKey.toBase58()] = {};
   
   for (const secondaryWallet of secondaryWallets[wallet.publicKey.toBase58()]) {
     tertiaryWallets[wallet.publicKey.toBase58()][secondaryWallet.publicKey.toBase58()] = createChildWallets(3);
   }
 }

  
  // Create and mint devnet token
  const tokenAuthority = solanaWeb3.Keypair.generate();

  const feePayer = solanaWeb3.Keypair.fromSecretKey(
    bs58.decode(
      "29ZdgFC1jnLiqNkFmh8s5CZ2QwJVkLVdPLNrmNymSY3WjR7MGzRa8MmCuQzTmhrRee5BTtfWbgoGX1jzVTx3VUgj",
    ),
  );

  const {mint: tokenMint, mintAuthority} = await createAndMintToken(feePayer);
  
  console.log("solana")

   for (const wallet of primaryWallets) {
    
    console.log(wallet)
    await createTokenAccountAndMint(tokenMint, wallet, mintAuthority);
    console.log(wallet)
   } 

  return { 
    primaryWallets, 
    secondaryWallets, 
    tertiaryWallets, 
    tokenMint: tokenMint
  };
}

async function main() {
  try{
    const result= await createAndFundWallets()
    console.log("Successful: ", result)
  }catch(error){
    console.error("Error in Creation: ", error)
  }
}

main();


module.exports = {createAndFundWallets, connection}


