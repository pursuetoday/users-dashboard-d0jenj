/**
 * Encryption Utility Unit Tests
 * 
 * Comprehensive test suite for the encryption utility module that verifies
 * the functionality of encryption, decryption and hashing operations with
 * thorough security validation and edge case testing.
 * 
 * @jest-environment node
 * @version 1.0.0
 */

import { encrypt, decrypt, hash } from '../../../src/utils/encryption.util';
// jest version ^29.0.0

describe('Encryption Utility', () => {
  
  describe('encrypt', () => {
    test('should encrypt data successfully', async () => {
      // Arrange
      const testData = 'sensitive-data-to-encrypt';
      
      // Act
      const encrypted = encrypt(testData);
      
      // Assert
      expect(encrypted).toBeTruthy();
      
      // Format should be iv:encryptedData:hmac
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      
      // IV should be 16 bytes (32 hex chars)
      expect(parts[0].length).toBe(32);
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
      
      // Encrypted data should exist and be valid hex
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);
      
      // HMAC should be SHA-256 (64 hex chars)
      expect(parts[2].length).toBe(64);
      expect(parts[2]).toMatch(/^[0-9a-f]{64}$/);
    });
    
    test('should handle empty string', async () => {
      // Empty strings should be rejected according to implementation
      expect(() => encrypt('')).toThrow(/Invalid input/);
    });
    
    test('should generate different IVs for same data', async () => {
      // Arrange
      const testData = 'same-data-for-multiple-encryptions';
      
      // Act - encrypt the same data multiple times
      const results = Array.from({ length: 5 }, () => encrypt(testData));
      
      // Extract IVs from all encryptions
      const ivs = results.map(result => result.split(':')[0]);
      
      // Assert - all IVs should be unique (cryptographically random)
      const uniqueIVs = new Set(ivs);
      expect(uniqueIVs.size).toBe(results.length);
      
      // All should decrypt back to the original
      for (const encrypted of results) {
        expect(decrypt(encrypted)).toBe(testData);
      }
    });
    
    test('should throw error for null or undefined input', async () => {
      // Act & Assert
      expect(() => encrypt(null as unknown as string)).toThrow(/Invalid input/);
      expect(() => encrypt(undefined as unknown as string)).toThrow(/Invalid input/);
    });
    
    test('should throw error for non-string input', async () => {
      // Act & Assert
      expect(() => encrypt(123 as unknown as string)).toThrow(/Invalid input/);
      expect(() => encrypt({} as unknown as string)).toThrow(/Invalid input/);
      expect(() => encrypt([] as unknown as string)).toThrow(/Invalid input/);
      expect(() => encrypt(true as unknown as string)).toThrow(/Invalid input/);
    });
  });
  
  describe('decrypt', () => {
    test('should decrypt encrypted data correctly', async () => {
      // Arrange
      const originalData = 'sensitive-data-for-encryption-decryption-cycle';
      const encrypted = encrypt(originalData);
      
      // Act
      const decrypted = decrypt(encrypted);
      
      // Assert
      expect(decrypted).toBe(originalData);
    });
    
    test('should throw error for invalid encrypted data format', async () => {
      // Arrange - test various invalid format scenarios
      const invalidFormats = [
        'not-valid-encrypted-data',
        'only:one-separator',
        'too:many:separators:here',
        ':empty:parts',
        '::',
        '123', // too short
        'a'.repeat(100), // no separators
      ];
      
      // Act & Assert
      for (const invalid of invalidFormats) {
        expect(() => decrypt(invalid)).toThrow(/Invalid encrypted data format/);
      }
    });
    
    test('should throw error for tampered data', async () => {
      // Arrange
      const originalData = 'data-to-be-tampered-with';
      const encrypted = encrypt(originalData);
      const parts = encrypted.split(':');
      
      // Create tampered data scenarios
      
      // 1. Tampered IV
      const tamperedIV = `${'a'.repeat(32)}:${parts[1]}:${parts[2]}`;
      
      // 2. Tampered encrypted content
      const tamperedContent = `${parts[0]}:${parts[1].replace(/[a-f]/g, '0')}:${parts[2]}`;
      
      // 3. Tampered HMAC
      const tamperedHMAC = `${parts[0]}:${parts[1]}:${'0'.repeat(64)}`;
      
      // Act & Assert - all should fail integrity check
      expect(() => decrypt(tamperedIV)).toThrow(/integrity check failed/i);
      expect(() => decrypt(tamperedContent)).toThrow(/integrity check failed/i);
      expect(() => decrypt(tamperedHMAC)).toThrow(/integrity check failed/i);
    });
    
    test('should throw error for empty input', async () => {
      // Act & Assert
      expect(() => decrypt('')).toThrow(/Invalid input/);
    });
    
    test('should throw error for invalid IV length', async () => {
      // Arrange
      const originalData = 'test-data-for-iv-validation';
      const encrypted = encrypt(originalData);
      const parts = encrypted.split(':');
      
      // Create data with invalid IV lengths
      const shortIV = `${'a'.repeat(30)}:${parts[1]}:${parts[2]}`; // 15 bytes
      const longIV = `${'a'.repeat(34)}:${parts[1]}:${parts[2]}`; // 17 bytes
      
      // Act & Assert - HMAC validation should fail due to IV manipulation
      expect(() => decrypt(shortIV)).toThrow(/integrity check failed/i);
      expect(() => decrypt(longIV)).toThrow(/integrity check failed/i);
    });
  });
  
  describe('hash', () => {
    test('should generate consistent hash for same input', async () => {
      // Arrange
      const testData = 'data-to-hash';
      
      // Act
      const hash1 = hash(testData);
      const hash2 = hash(testData);
      
      // Assert
      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1.length).toBe(64); // SHA-256 = 64 hex chars
      expect(hash1).toMatch(/^[0-9a-f]{64}$/); // Valid hex format
    });
    
    test('should generate different hashes for different inputs', async () => {
      // Arrange - test various distinct inputs
      const testInputs = [
        'first-data',
        'second-data',
        'third-data with more text',
        'special characters: !@#$%^&*()',
        '1234567890',
        'a'.repeat(100), // long input
      ];
      
      // Act
      const hashes = testInputs.map(input => hash(input));
      
      // Assert - all hashes should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(testInputs.length);
      
      // All hashes should have correct format
      for (const h of hashes) {
        expect(h.length).toBe(64);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
      }
    });
    
    test('should throw error for empty input', async () => {
      // Act & Assert
      expect(() => hash('')).toThrow(/Invalid input/);
    });
    
    test('should throw error for null or undefined input', async () => {
      // Act & Assert
      expect(() => hash(null as unknown as string)).toThrow(/Invalid input/);
      expect(() => hash(undefined as unknown as string)).toThrow(/Invalid input/);
    });
    
    test('should throw error for non-string input', async () => {
      // Act & Assert
      expect(() => hash(123 as unknown as string)).toThrow(/Invalid input/);
      expect(() => hash({} as unknown as string)).toThrow(/Invalid input/);
      expect(() => hash([] as unknown as string)).toThrow(/Invalid input/);
    });
  });
  
  // Test end-to-end crypto operations
  describe('end-to-end crypto operations', () => {
    test('should successfully perform encrypt-decrypt cycle with various inputs', async () => {
      // Arrange - test various input types and edge cases
      const testCases = [
        'short text',
        'longer text with spaces and punctuation!',
        'Special characters: !@#$%^&*()_+-=[]{}|;:\'",.<>/?',
        'Numbers: 1234567890',
        'Unicode: 你好世界 (Hello World in Chinese)',
        'Mixed content: ABC123!@# 你好',
        'a'.repeat(1000), // Long input
      ];
      
      // Act & Assert - all should encrypt and decrypt correctly
      for (const testCase of testCases) {
        const encrypted = encrypt(testCase);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(testCase);
      }
    });
    
    test('should maintain data integrity through complete cycle', async () => {
      // Arrange
      const originalData = 'sensitive-data-for-complete-cycle';
      
      // Act
      const encrypted = encrypt(originalData);
      const decrypted = decrypt(encrypted);
      const hashOriginal = hash(originalData);
      const hashDecrypted = hash(decrypted);
      
      // Assert
      expect(decrypted).toBe(originalData);
      expect(hashDecrypted).toBe(hashOriginal);
    });
  });
});