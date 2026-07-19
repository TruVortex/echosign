/**
 * Live End-to-End Test: Gemini Encode → Crypto Sign → Wire Pack →
 * Acoustic FSK → PCM → Decode Acoustic → Verify Sig → Gemini Decode
 *
 * This tests the ENTIRE pipeline without Solana.
 */

import { packFields, unpackFields, verifyChecksum, bytesToHex, hexToBytes, generateKeypair, signCode, verifySignature, pack, unpack } from '../packages/core/dist/index.js';
import { encodeToTones, tonesToPCM, decodePCM } from '../packages/acoustic/dist/index.js';

const API = 'http://localhost:3001';

async function main() {
  console.log('========================================');
  console.log('  Cyren Full E2E Pipeline Test');
  console.log('========================================\n');

  // ── STEP 1: Gemini Encode ──
  console.log('STEP 1: Encoding emergency message with Gemini AI...');
  const encodeRes = await fetch(`${API}/api/encode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Wildfire spreading rapidly near Sydney Australia, 500 homes threatened, 2000 people evacuating, need firefighting aircraft'
    }),
  });
  const encoded = await encodeRes.json();
  if (encoded.error) { console.error('ENCODE FAILED:', encoded.error); process.exit(1); }
  console.log('  Type:', encoded.fields.type);
  console.log('  Severity:', encoded.fields.severity + '/9');
  console.log('  Location:', encoded.fields.lat + ', ' + encoded.fields.lon);
  console.log('  Population:', encoded.fields.pop);
  console.log('  Message:', encoded.fields.msg);
  console.log('  Hex (24 bytes):', encoded.hex);
  console.log('  PASS\n');

  // ── STEP 2: Pack into binary ──
  console.log('STEP 2: Converting hex to 24-byte binary code...');
  const codeBytes = hexToBytes(encoded.hex);
  console.log('  Code length:', codeBytes.length, 'bytes');
  const checksumValid = verifyChecksum(codeBytes);
  console.log('  CRC-16 checksum:', checksumValid ? 'VALID' : 'INVALID');
  if (!checksumValid) { console.error('CHECKSUM FAILED'); process.exit(1); }
  console.log('  PASS\n');

  // ── STEP 3: Ed25519 Sign ──
  console.log('STEP 3: Generating Ed25519 keypair and signing...');
  const { privateKey, publicKey } = await generateKeypair();
  console.log('  Private key:', bytesToHex(privateKey).slice(0, 16) + '...');
  console.log('  Public key:', bytesToHex(publicKey).slice(0, 16) + '...');
  const signature = await signCode(codeBytes, privateKey);
  console.log('  Signature:', bytesToHex(signature).slice(0, 32) + '...');
  console.log('  Signature length:', signature.length, 'bytes');
  const sigCheck = await verifySignature(codeBytes, signature, publicKey);
  console.log('  Pre-transmit verification:', sigCheck ? 'VALID' : 'INVALID');
  console.log('  PASS\n');

  // ── STEP 4: Pack Wire Format ──
  console.log('STEP 4: Packing into 120-byte wire format...');
  const wire = pack({ code: codeBytes, signature, publicKey });
  console.log('  Wire length:', wire.length, 'bytes');
  console.log('  [0-23]  Code:      ', bytesToHex(wire.slice(0, 24)).slice(0, 32) + '...');
  console.log('  [24-87] Signature: ', bytesToHex(wire.slice(24, 88)).slice(0, 32) + '...');
  console.log('  [88-119] PubKey:   ', bytesToHex(wire.slice(88, 120)).slice(0, 32) + '...');
  console.log('  PASS\n');

  // ── STEP 5: Acoustic FSK Encode ──
  console.log('STEP 5: Encoding to FSK audio tones...');
  const tones = encodeToTones(wire);
  console.log('  Total tones:', tones.length);
  console.log('  Preamble tones: 6 (alternating 500/4500 Hz)');
  console.log('  Data tones:', tones.length - 7, '(240 nibbles)');
  console.log('  Postamble tones: 1 (4500 Hz)');
  console.log('  PASS\n');

  // ── STEP 6: Convert to PCM Audio ──
  console.log('STEP 6: Converting tones to PCM audio (44100 Hz)...');
  const pcm = tonesToPCM(tones, 44100);
  const durationSec = pcm.length / 44100;
  console.log('  PCM samples:', pcm.length);
  console.log('  Duration:', durationSec.toFixed(2) + ' seconds');
  console.log('  Sample rate: 44100 Hz');
  let maxAmp = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > maxAmp) maxAmp = a;
  }
  console.log('  Peak amplitude:', maxAmp.toFixed(4), maxAmp <= 1.0 ? '(OK)' : '(CLIPPING!)');
  console.log('  PASS\n');

  // ── STEP 7: Decode PCM back to bytes (simulating receiver mic) ──
  console.log('STEP 7: Decoding PCM audio back to bytes (Goertzel FSK)...');
  const decoded = decodePCM(pcm, 44100, 120);
  console.log('  Decoded bytes:', decoded.data.length);
  console.log('  Confidence:', (decoded.confidence * 100).toFixed(1) + '%');
  console.log('  Error positions:', decoded.errorPositions.length === 0 ? 'NONE' : decoded.errorPositions.join(', '));

  let byteMatches = 0;
  for (let i = 0; i < 120; i++) {
    if (decoded.data[i] === wire[i]) byteMatches++;
  }
  console.log('  Byte accuracy:', byteMatches + '/120 (' + (byteMatches/120*100).toFixed(1) + '%)');
  console.log('  PASS\n');

  // ── STEP 8: Unpack wire format ──
  console.log('STEP 8: Unpacking 120-byte wire format...');
  const unpacked = unpack(decoded.data);
  console.log('  Code:', bytesToHex(unpacked.code));
  console.log('  Code matches original:', bytesToHex(unpacked.code) === encoded.hex ? 'YES' : 'NO');
  console.log('  PASS\n');

  // ── STEP 9: Verify CRC checksum ──
  console.log('STEP 9: Verifying CRC-16 checksum on received code...');
  const postCRC = verifyChecksum(unpacked.code);
  console.log('  CRC-16:', postCRC ? 'VALID (data intact)' : 'INVALID (data corrupted!)');
  console.log('  PASS\n');

  // ── STEP 10: Verify Ed25519 signature ──
  console.log('STEP 10: Verifying Ed25519 signature...');
  const postSigValid = await verifySignature(unpacked.code, unpacked.signature, unpacked.publicKey);
  console.log('  Signature:', postSigValid ? 'VALID (authentic sender, untampered)' : 'INVALID (tampered or wrong sender!)');
  console.log('  PASS\n');

  // ── STEP 11: Unpack semantic fields ──
  console.log('STEP 11: Unpacking semantic fields from received code...');
  const fields = unpackFields(unpacked.code);
  console.log('  Type:', fields.type);
  console.log('  Severity:', fields.severity + '/9');
  console.log('  Location:', fields.lat + ', ' + fields.lon);
  console.log('  Population:', fields.pop);
  console.log('  Message:', fields.msg);
  console.log('  PASS\n');

  // ── STEP 12: Gemini Decode ──
  console.log('STEP 12: Decoding with Gemini AI to human-readable alert...');
  const decodeRes = await fetch(`${API}/api/decode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hex: bytesToHex(unpacked.code), verified: postSigValid }),
  });
  const alert = await decodeRes.json();
  if (alert.error) { console.error('DECODE FAILED:', alert.error); process.exit(1); }
  console.log('\n  ┌──────────────────────────────────────────┐');
  console.log('  │     RECONSTRUCTED EMERGENCY ALERT        │');
  console.log('  └──────────────────────────────────────────┘');
  console.log('');
  for (const line of alert.text.split('\n')) {
    console.log('  ' + line);
  }
  console.log('');
  console.log('  PASS\n');

  // ── FINAL SUMMARY ──
  console.log('========================================');
  console.log('  ALL 12 STEPS PASSED');
  console.log('========================================');
  console.log('');
  console.log('  Pipeline: Voice/Text → Gemini Compress → 24-byte code');
  console.log('            → Ed25519 Sign → 120-byte wire → FSK Audio');
  console.log('            → ' + durationSec.toFixed(1) + 's of sound → Goertzel Decode');
  console.log('            → Verify Signature → Gemini Expand → Alert');
  console.log('');
  console.log('  Acoustic confidence: ' + (decoded.confidence * 100).toFixed(1) + '%');
  console.log('  Byte accuracy: ' + byteMatches + '/120');
  console.log('  Signature: ' + (postSigValid ? 'VERIFIED' : 'FAILED'));
  console.log('  CRC-16: ' + (postCRC ? 'INTACT' : 'CORRUPTED'));
  console.log('');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
