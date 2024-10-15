const { Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { connection } = require('./walletSetup');

async function executeChainTransaction(walletA, walletB, walletC, walletD, tokenMint) {
  // Step 1: Transfer from A to B
  const transferAtoB = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletA.publicKey,
      toPubkey: walletB.publicKey,
      lamports: LAMPORTS_PER_SOL / 2
    })
  );
  await connection.sendTransaction(transferAtoB, [walletA]);
  console.log('Transfer from A to B completed');

  // Step 2: Transfer from B to C
  const transferBtoC = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletB.publicKey,
      toPubkey: walletC.publicKey,
      lamports: LAMPORTS_PER_SOL / 3
    })
  );
  await connection.sendTransaction(transferBtoC, [walletB]);
  console.log('Transfer from B to C completed');

  // Step 3: Transfer some SOL from C to D
  const transferCtoD = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletC.publicKey,
      toPubkey: walletD.publicKey,
      lamports: LAMPORTS_PER_SOL / 4
    })
  );
  await connection.sendTransaction(transferCtoD, [walletC]);
  console.log('Transfer from C to D completed');

  // Step 4: Use Jupiter API to buy tokens with SOL in D
  // This step will be implemented in jupiterSwap.js

  // Step 5: Transfer remaining SOL and tokens from C to D
  const token = new Token(connection, tokenMint, TOKEN_PROGRAM_ID, walletC);
  const tokenAccountC = await token.getOrCreateAssociatedAccountInfo(walletC.publicKey);
  const tokenAccountD = await token.getOrCreateAssociatedAccountInfo(walletD.publicKey);

  const finalTransfer = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletC.publicKey,
      toPubkey: walletD.publicKey,
      lamports: await connection.getBalance(walletC.publicKey) - 5000 // Leave some for rent
    }),
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      tokenAccountC.address,
      tokenAccountD.address,
      walletC.publicKey,
      [],
      await token.getAccountInfo(tokenAccountC.address).then(info => info.amount.toNumber())
    )
  );
  await connection.sendTransaction(finalTransfer, [walletC]);
  console.log('Final transfer from C to D completed');

  console.log('Chain transaction completed successfully');
}

module.exports = { executeChainTransaction };