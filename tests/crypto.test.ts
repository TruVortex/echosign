import { describe, it, expect } from 'vitest';
import { generateKeypair, signCode, verifySignature } from '../packages/core/src/crypto.js';

describe('Ed25519 Crypto', () => {
  it('should generate a keypair with correct sizes', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    expect(privateKey.length).toBe(32);
    expect(publicKey.length).toBe(32);
  });

  it('should sign and verify a code', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const code = new Uint8Array(24).fill(0xAB);

    const signature = await signCode(code, privateKey);
    expect(signature.length).toBe(64);

    const valid = await verifySignature(code, signature, publicKey);
    expect(valid).toBe(true);
  });

  it('should reject tampered data', async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const code = new Uint8Array(24).fill(0xAB);
    const signature = await signCode(code, privateKey);

    // Tamper with the code
    const tampered = new Uint8Array(code);
    tampered[0] = 0x00;

    const valid = await verifySignature(tampered, signature, publicKey);
    expect(valid).toBe(false);
  });

  it('should reject wrong public key', async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const code = new Uint8Array(24).fill(0xCD);

    const signature = await signCode(code, kp1.privateKey);
    const valid = await verifySignature(code, signature, kp2.publicKey);
    expect(valid).toBe(false);
  });
});
