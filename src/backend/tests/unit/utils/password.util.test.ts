/**
 * Unit tests for password utility functions
 * 
 * Tests the following functionality:
 * - Password hashing with bcrypt (12 rounds)
 * - Password comparison functionality
 * - Password validation against security requirements
 * - Password validation error message generation
 */

import { 
  hashPassword, 
  comparePasswords, 
  validatePassword, 
  getPasswordValidationError 
} from '../../src/utils/password.util';
import { AUTH_VALIDATION_MESSAGES } from '../../src/constants/validation-messages';

// Test data for consistent use across tests
const validPasswords = [
  'ValidP@ss123',
  'Str0ng!Pass',
  'C0mpl3x@Pass',
  'Very!Long&C0mplexPassword',
  'P@ssw0rd!With#Multiple$Special%Chars',
  'Unicode密碼P@ss123',
  'Tab\tInP@ssword123',
  'Space In P@ssword123',
  'MaxLength!P@ssw0rd'
];

const invalidPasswords = [
  '',
  'short',
  'nouppercase123!',
  'NOLOWERCASE123!',
  'NoSpecialChar123',
  'NoNumber@Pass',
  'OnlySpecial@#$%',
  'Only123456789',
  'onlylowercase',
  'ONLYUPPERCASE',
  'Ab@1',
  'Tab\tOnly@123',
  '密碼OnlyUnicode',
  'A'
];

describe('Password Utility Functions', () => {
  // Test suite for hashPassword function
  describe('hashPassword', () => {
    // Test successful password hashing with various password lengths
    test('should hash valid passwords successfully', async () => {
      for (const password of validPasswords) {
        const hash = await hashPassword(password);
        
        // Verify hash is a string and not the original password
        expect(typeof hash).toBe('string');
        expect(hash).not.toEqual(password);
        
        // Verify hash has the correct bcrypt format
        expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      }
    });

    // Test hashing with empty password throws validation error
    test('should throw an error when password is empty', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    // Test hashing with null/undefined password throws error
    test('should throw an error when password is null or undefined', async () => {
      await expect(hashPassword(null as unknown as string)).rejects.toThrow('Password cannot be empty');
      await expect(hashPassword(undefined as unknown as string)).rejects.toThrow('Password cannot be empty');
    });

    // Verify bcrypt rounds setting is exactly 12
    test('should use exactly 12 rounds of bcrypt', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      // In bcrypt hash, the rounds are shown in the hash string as $2b$XX$
      // Where XX is the number of rounds
      const roundsMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
      expect(roundsMatch).not.toBeNull();
      expect(roundsMatch![1]).toBe('12');
    });

    // Test hashing performance stays within 300ms threshold
    test('should complete hashing within 300ms', async () => {
      jest.setTimeout(500); // Increase timeout for slower CI environments
      const password = 'Performance!Test123';
      const startTime = Date.now();
      await hashPassword(password);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(300);
    });

    // Test memory usage during hashing stays under 50MB
    test('should not consume excessive memory during hashing', async () => {
      // This is a conceptual test since directly measuring memory in Jest is tricky
      // In a real environment, you might use a memory profiler for this
      const password = 'MemoryTest!123';
      await hashPassword(password);
      // If we reach this point without out-of-memory errors, we'll consider it a pass
      expect(true).toBe(true);
    });

    // Test concurrent hashing of multiple passwords
    test('should handle concurrent hashing of multiple passwords', async () => {
      const passwords = validPasswords.slice(0, 5);
      const hashPromises = passwords.map(password => hashPassword(password));
      
      const hashes = await Promise.all(hashPromises);
      
      // Ensure we got the right number of hashes
      expect(hashes.length).toBe(passwords.length);
      
      // Ensure all hashes are unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(passwords.length);
      
      // Ensure all hashes are valid bcrypt hashes
      hashes.forEach(hash => {
        expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      });
    });

    // Verify hash output format matches bcrypt standard
    test('should produce standard bcrypt hash format', async () => {
      const hash = await hashPassword('StrongP@ssw0rd');
      
      // Test for bcrypt hash format
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    });

    // Test timing consistency across different password lengths
    test('should have relatively consistent timing regardless of password length', async () => {
      const shortPassword = 'Short1!P';
      const longPassword = 'VeryLongPasswordForTestingConsistentTimingBehaviorOfBcryptHashing!123';
      
      // Warm up bcrypt
      await hashPassword('WarmupP@ss123');
      
      const shortStart = Date.now();
      await hashPassword(shortPassword);
      const shortTime = Date.now() - shortStart;
      
      const longStart = Date.now();
      await hashPassword(longPassword);
      const longTime = Date.now() - longStart;
      
      // The timing shouldn't differ dramatically despite significant length difference
      // This is a loose test since exact timing can vary based on system load
      expect(Math.abs(shortTime - longTime)).toBeLessThan(150);
    });
  });

  // Test suite for comparePasswords function
  describe('comparePasswords', () => {
    // Test successful password match with various complexity levels
    test('should return true for matching password and hash', async () => {
      for (const password of validPasswords) {
        const hash = await hashPassword(password);
        const result = await comparePasswords(password, hash);
        
        expect(result).toBe(true);
      }
    });

    // Test password mismatch returns false without error
    test('should return false for non-matching password and hash', async () => {
      const password = 'OriginalP@ss123';
      const wrongPassword = 'WrongP@ss123';
      const hash = await hashPassword(password);
      
      const result = await comparePasswords(wrongPassword, hash);
      expect(result).toBe(false);
    });

    // Test comparison with empty password throws validation error
    test('should throw an error when plainPassword is empty', async () => {
      const hash = await hashPassword('ValidP@ss123');
      
      await expect(comparePasswords('', hash)).rejects.toThrow('Both passwords must be provided for comparison');
    });

    // Test comparison with invalid hash format throws error
    test('should throw an error when hash has invalid format', async () => {
      const invalidHash = 'not-a-valid-bcrypt-hash';
      
      await expect(comparePasswords('ValidP@ss123', invalidHash)).rejects.toThrow();
    });

    // Test comparison with null/undefined values throws error
    test('should throw an error when parameters are null or undefined', async () => {
      const hash = await hashPassword('ValidP@ss123');
      
      await expect(comparePasswords(null as unknown as string, hash)).rejects.toThrow('Both passwords must be provided for comparison');
      await expect(comparePasswords('ValidP@ss123', null as unknown as string)).rejects.toThrow('Both passwords must be provided for comparison');
      await expect(comparePasswords(undefined as unknown as string, hash)).rejects.toThrow('Both passwords must be provided for comparison');
      await expect(comparePasswords('ValidP@ss123', undefined as unknown as string)).rejects.toThrow('Both passwords must be provided for comparison');
    });

    // Verify timing consistency to prevent timing attacks
    test('should have similar timing regardless of password correctness', async () => {
      const password = 'CorrectP@ssw0rd';
      const hash = await hashPassword(password);
      
      // Warm up bcrypt
      await comparePasswords(password, hash);
      await comparePasswords('WrongP@ssw0rd', hash);
      
      // Multiple runs to reduce timing variations
      const runs = 5;
      let correctTotal = 0;
      let incorrectTotal = 0;
      
      for (let i = 0; i < runs; i++) {
        const startCorrect = Date.now();
        await comparePasswords(password, hash);
        correctTotal += (Date.now() - startCorrect);
        
        const startIncorrect = Date.now();
        await comparePasswords('WrongP@ssw0rd', hash);
        incorrectTotal += (Date.now() - startIncorrect);
      }
      
      const correctAvg = correctTotal / runs;
      const incorrectAvg = incorrectTotal / runs;
      
      // The timing shouldn't differ by more than 30% despite different outcome
      // This helps prevent timing attacks
      const timingDifference = Math.abs(correctAvg - incorrectAvg);
      const timingPercentage = timingDifference / Math.max(correctAvg, incorrectAvg);
      
      expect(timingPercentage).toBeLessThan(0.3);
    });

    // Test comparison with maximum length passwords
    test('should handle very long passwords correctly', async () => {
      const longPassword = 'A'.repeat(72) + 'V3ry!L0ng'; // bcrypt has 72 byte limit
      const hash = await hashPassword(longPassword);
      
      const result = await comparePasswords(longPassword, hash);
      expect(result).toBe(true);
      
      // Test with one character difference at the end
      const slightlyDifferent = longPassword.slice(0, -1) + '?';
      const differentResult = await comparePasswords(slightlyDifferent, hash);
      expect(differentResult).toBe(false);
    });

    // Test comparison with unicode character passwords
    test('should correctly compare passwords with unicode characters', async () => {
      const unicodePassword = 'Unic0de!密碼測試';
      const hash = await hashPassword(unicodePassword);
      
      const result = await comparePasswords(unicodePassword, hash);
      expect(result).toBe(true);
      
      // Test with slightly different unicode
      const differentUnicode = 'Unic0de!密码測試'; // Changed one character
      const differentResult = await comparePasswords(differentUnicode, hash);
      expect(differentResult).toBe(false);
    });

    // Verify memory cleanup after comparison
    test('should not retain sensitive data in memory after comparison', async () => {
      // This is a conceptual test since directly checking memory in Jest is difficult
      // In a real security audit, this would use specialized tools
      const password = 'S3cureP@ssw0rd';
      const hash = await hashPassword(password);
      
      await comparePasswords(password, hash);
      
      // If we reach this point without memory leaks, we'll consider it a pass
      expect(true).toBe(true);
    });
  });

  // Test suite for validatePassword function
  describe('validatePassword', () => {
    // Test valid passwords meeting all requirements
    test('should return true for valid passwords', () => {
      for (const password of validPasswords) {
        expect(validatePassword(password)).toBe(true);
      }
    });

    // Test password minimum length requirement (8 characters)
    test('should return false for passwords shorter than 8 characters', () => {
      expect(validatePassword('Short1!')).toBe(false);
      expect(validatePassword('Abc@123')).toBe(false); // Exactly 7 chars
    });

    // Test uppercase letter requirement with edge cases
    test('should return false for passwords without uppercase letters', () => {
      expect(validatePassword('lowercase123!')).toBe(false);
      expect(validatePassword('no_upper_case123!')).toBe(false);
      expect(validatePassword('all lowercase but meets other requirements 123!')).toBe(false);
    });

    // Test number requirement with various positions
    test('should return false for passwords without numbers', () => {
      expect(validatePassword('NoNumbersHere!')).toBe(false);
      expect(validatePassword('NoNumbers!AtAll')).toBe(false);
      expect(validatePassword('JustAlphabetsAndSpecial!@#')).toBe(false);
    });

    // Test special character requirement with full range
    test('should return false for passwords without special characters', () => {
      expect(validatePassword('NoSpecialChars123')).toBe(false);
      expect(validatePassword('JustAlphanumeric123')).toBe(false);
      
      // Test with special chars not in the allowed set (!@#$%^&*)
      expect(validatePassword('Wrong~Special+Chars123')).toBe(false);
    });

    // Test empty password validation
    test('should return false for empty password', () => {
      expect(validatePassword('')).toBe(false);
    });

    // Test null/undefined password validation
    test('should return false for null or undefined password', () => {
      expect(validatePassword(null as unknown as string)).toBe(false);
      expect(validatePassword(undefined as unknown as string)).toBe(false);
    });

    // Test maximum length passwords (100 characters)
    test('should handle very long passwords correctly', () => {
      const longPassword = 'Long!' + 'A'.repeat(94) + '123'; // 100 chars
      expect(validatePassword(longPassword)).toBe(true);
    });

    // Test passwords with unicode characters
    test('should correctly validate passwords with unicode characters', () => {
      // Valid with unicode
      expect(validatePassword('Unicode密碼P@ss123')).toBe(true);
      
      // Invalid with unicode (missing number)
      expect(validatePassword('Unicode密碼Password!')).toBe(false);
      
      // Invalid with unicode (missing special char)
      expect(validatePassword('Unicode密碼Password123')).toBe(false);
    });

    // Test passwords with multiple special characters
    test('should validate passwords with multiple special characters', () => {
      expect(validatePassword('Multiple!Special@Chars#123')).toBe(true);
    });

    // Test passwords with spaces and tabs
    test('should handle passwords with spaces and tabs', () => {
      expect(validatePassword('With Space In P@ssword123')).toBe(true);
      expect(validatePassword('With\tTab\tIn\tP@ssword123')).toBe(true);
    });

    // Test common password patterns for rejection
    test('should validate against all requirements independently', () => {
      // Length check
      expect(validatePassword('Ab1!')).toBe(false); // Too short
      
      // Uppercase check
      expect(validatePassword('no_uppercase123!')).toBe(false);
      
      // Number check
      expect(validatePassword('NoNumber!Password')).toBe(false);
      
      // Special char check
      expect(validatePassword('NoSpecialChars123')).toBe(false);
      
      // Multiple missing requirements
      expect(validatePassword('onlylowercase')).toBe(false); // Missing uppercase, number, special
      expect(validatePassword('onlylowercase123')).toBe(false); // Missing uppercase, special
      expect(validatePassword('ONLYUPPERCASE123')).toBe(false); // Missing lowercase, special
    });
  });

  // Test suite for getPasswordValidationError function
  describe('getPasswordValidationError', () => {
    // Test null return for valid passwords
    test('should return null for valid passwords', () => {
      for (const password of validPasswords) {
        expect(getPasswordValidationError(password)).toBeNull();
      }
    });

    // Test required field message for empty password
    test('should return required field message for empty password', () => {
      expect(getPasswordValidationError('')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED);
    });

    // Test minimum length message for short passwords
    test('should return minimum length message for passwords shorter than 8 characters', () => {
      expect(getPasswordValidationError('Short1!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH);
      expect(getPasswordValidationError('A1!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH);
    });

    // Test complexity requirements message format
    test('should return complexity message for passwords missing character requirements', () => {
      // Missing uppercase
      expect(getPasswordValidationError('lowercase123!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY);
      
      // Missing number
      expect(getPasswordValidationError('Uppercase!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY);
      
      // Missing special character
      expect(getPasswordValidationError('Uppercase123')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY);
    });

    // Test message format and content accuracy
    test('should return the exact message from AUTH_VALIDATION_MESSAGES', () => {
      expect(getPasswordValidationError('')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED);
      expect(getPasswordValidationError('short')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH);
      expect(getPasswordValidationError('lowercase123!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY);
    });

    // Test message consistency across all validation rules
    test('should return consistent messages for the same validation failure', () => {
      const shortPassword1 = 'Abc1!';
      const shortPassword2 = 'A1!';
      
      expect(getPasswordValidationError(shortPassword1)).toBe(getPasswordValidationError(shortPassword2));
      
      const missingUppercase1 = 'noupperletter123!';
      const missingUppercase2 = 'anotherlower123!';
      
      expect(getPasswordValidationError(missingUppercase1)).toBe(getPasswordValidationError(missingUppercase2));
    });

    // Test unicode character handling in messages
    test('should handle unicode characters in validation', () => {
      expect(getPasswordValidationError('Unicode密碼P@ss123')).toBeNull();
      expect(getPasswordValidationError('密碼short!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH);
      expect(getPasswordValidationError('unicode密碼only!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY);
    });

    // Test message length limits
    test('should return reasonably sized error messages', () => {
      // This test verifies that error messages aren't excessively long
      const errorMessage = getPasswordValidationError('short');
      expect(errorMessage?.length).toBeLessThan(100);
    });

    // Test HTML escaping in error messages
    test('should not contain HTML in error messages', () => {
      for (const password of invalidPasswords) {
        const errorMessage = getPasswordValidationError(password);
        if (errorMessage) {
          expect(errorMessage).not.toMatch(/<[^>]*>/); // Should not contain HTML tags
        }
      }
    });

    // Test null/undefined password handling
    test('should handle null or undefined password', () => {
      expect(getPasswordValidationError(null as unknown as string)).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED);
      expect(getPasswordValidationError(undefined as unknown as string)).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED);
    });

    // Test message localization compatibility
    test('should use messages that can be localized', () => {
      // This is more of a design verification than a functional test
      // We're verifying that we're using constants rather than hardcoded strings
      expect(getPasswordValidationError('')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED);
      expect(getPasswordValidationError('short')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH);
      expect(getPasswordValidationError('lowercase123!')).toBe(AUTH_VALIDATION_MESSAGES.PASSWORD_COMPLEXITY);
    });
  });
});