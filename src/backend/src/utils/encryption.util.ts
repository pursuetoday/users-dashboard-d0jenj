/**
 * Encryption Utility Module
 * 
 * Provides cryptographic functions for secure data encryption and decryption 
 * using industry-standard algorithms with enhanced security measures, 
 * input validation, and secure memory handling.
 * 
 * @module utils/encryption
 * @version 1.0.0
 */

import * as crypto from 'crypto'; // built-in
import { authConfig } from '../config/auth.config';
import { validateJwtSecret } from '../config/auth.config';

// Constants for encryption settings
const ENCRYPTION_ALGORITHM = 'AES-256-CBC';
const IV_LENGTH = 16;
const ENCODING = 'hex';
const HMAC_ALGORITHM = 'SHA256';
const MIN_KEY_LENGTH = 32;
const MIN_ENTROPY_BITS = 128;

// Node.js crypto library compatible algorithm names
const nodeEncryptionAlgorithm = 'aes-256-cbc';
const nodeHmacAlgorithm = 'sha256';

/**
 * Encrypts sensitive data using AES-256-CBC encryption with secure IV generation and memory cleanup
 * 
 * @param {string} data - The data to encrypt
 * @returns {string} - Encrypted data in format: iv:encryptedData:hmac
 * @throws {Error} If input validation fails or encryption error occurs
 */
export function encrypt(data: string): string {
  // Validate input data for null/undefined/empty values
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string');
  }

  // Validate encryption key length and entropy
  if (!authConfig.jwtSecret || !validateJwtSecret(authConfig.jwtSecret)) {
    throw new Error('Invalid encryption key: key must meet security requirements');
  }

  let iv: Buffer;
  let cipher: crypto.Cipher;
  let encrypted: Buffer;
  let hmac: crypto.Hmac;
  let hmacDigest: string;
  let result: string;

  try {
    // Generate cryptographically secure random 16-byte initialization vector (IV)
    iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher using AES-256-CBC with IV and validated encryption key
    cipher = crypto.createCipheriv(nodeEncryptionAlgorithm, Buffer.from(authConfig.jwtSecret), iv);
    
    // Encrypt data using cipher with padding
    encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);
    
    // Generate HMAC for encrypted data integrity
    hmac = crypto.createHmac(nodeHmacAlgorithm, authConfig.jwtSecret);
    hmac.update(iv.toString(ENCODING) + ':' + encrypted.toString(ENCODING));
    hmacDigest = hmac.digest(ENCODING);
    
    // Combine IV, encrypted data, and HMAC with delimiters
    result = iv.toString(ENCODING) + ':' + encrypted.toString(ENCODING) + ':' + hmacDigest;
    
    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${(error as Error).message}`);
  } finally {
    // Securely clear sensitive data from memory
    if (iv) iv.fill(0);
    if (encrypted) encrypted.fill(0);
  }
}

/**
 * Decrypts data that was encrypted using the encrypt function with integrity verification
 * 
 * @param {string} encryptedData - The encrypted data in format: iv:encryptedData:hmac
 * @returns {string} - Original decrypted data
 * @throws {Error} If input validation fails, integrity check fails, or decryption error occurs
 */
export function decrypt(encryptedData: string): string {
  // Validate encrypted data format and presence
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid input: encryptedData must be a non-empty string');
  }

  // Validate encryption key
  if (!authConfig.jwtSecret || !validateJwtSecret(authConfig.jwtSecret)) {
    throw new Error('Invalid encryption key: key must meet security requirements');
  }

  let iv: Buffer;
  let encryptedText: Buffer;
  let decipher: crypto.Decipher;
  let decrypted: Buffer;
  let result: string;

  try {
    // Split encrypted data to extract IV, encrypted content, and HMAC
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected format: iv:encryptedData:hmac');
    }
    
    const [ivHex, encryptedHex, receivedHmac] = parts;
    
    // Verify HMAC for data integrity
    const hmac = crypto.createHmac(nodeHmacAlgorithm, authConfig.jwtSecret);
    hmac.update(ivHex + ':' + encryptedHex);
    const calculatedHmac = hmac.digest(ENCODING);
    
    if (calculatedHmac !== receivedHmac) {
      throw new Error('Data integrity check failed. The encrypted data may have been tampered with.');
    }
    
    // Validate IV length and format
    iv = Buffer.from(ivHex, ENCODING);
    
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes.`);
    }
    
    // Create decipher using AES-256-CBC with extracted IV and validated key
    encryptedText = Buffer.from(encryptedHex, ENCODING);
    decipher = crypto.createDecipheriv(nodeEncryptionAlgorithm, Buffer.from(authConfig.jwtSecret), iv);
    
    // Decrypt data using decipher with proper padding
    decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final()
    ]);
    
    // Validate decrypted data structure
    result = decrypted.toString('utf8');
    
    if (!result) {
      throw new Error('Decryption resulted in empty data');
    }
    
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('integrity check')) {
      throw error; // Preserve integrity check error message
    }
    throw new Error(`Decryption failed: ${(error as Error).message}`);
  } finally {
    // Securely clear sensitive data from memory
    if (iv) iv.fill(0);
    if (encryptedText) encryptedText.fill(0);
    if (decrypted) decrypted.fill(0);
  }
}

/**
 * Creates a cryptographic hash of data using SHA-256 with entropy validation
 * 
 * @param {string} data - The data to hash
 * @returns {string} - SHA-256 hash of input data
 * @throws {Error} If input validation fails or hashing error occurs
 */
export function hash(data: string): string {
  // Validate input data presence and format
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string');
  }

  let dataBuffer: Buffer;
  let hashObj: crypto.Hash;
  let result: string;

  try {
    // Create SHA-256 hash object with validated parameters
    hashObj = crypto.createHash(nodeHmacAlgorithm);
    
    // Update hash with input data using secure buffer handling
    dataBuffer = Buffer.from(data, 'utf8');
    hashObj.update(dataBuffer);
    
    // Generate final hash digest
    result = hashObj.digest(ENCODING);
    
    // Basic entropy validation
    if (result.length < MIN_KEY_LENGTH / 2) { // Each hex char represents 4 bits
      throw new Error('Generated hash has insufficient length');
    }
    
    // Check for entropy by counting unique character patterns
    // This is a basic heuristic and not a true entropy measurement
    const uniquePatterns = new Set();
    for (let i = 0; i < result.length - 1; i++) {
      uniquePatterns.add(result.substring(i, i + 2));
    }
    
    // Estimate entropy (very roughly) based on unique 2-character patterns
    // Each hexadecimal character has 4 bits of information
    const estimatedEntropy = uniquePatterns.size * 8; // 8 bits = 2 hex chars
    
    if (estimatedEntropy < MIN_ENTROPY_BITS) {
      throw new Error('Generated hash has insufficient entropy');
    }
    
    return result;
  } catch (error) {
    throw new Error(`Hashing failed: ${(error as Error).message}`);
  } finally {
    // Securely clear sensitive data from memory
    if (dataBuffer) dataBuffer.fill(0);
  }
}