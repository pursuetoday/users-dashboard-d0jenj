/**
 * JWT Utility Functions Tests
 * 
 * Comprehensive test suite for JWT utility functions that verify token 
 * generation, verification, and decoding functionality with enhanced 
 * security validation and error handling.
 * 
 * @group unit/utils
 * @category authentication
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  generateToken, 
  verifyToken, 
  decodeToken 
} from '../../../src/utils/jwt.util';
import { JwtPayload } from '../../../src/interfaces/jwt-payload.interface';
import { AuthenticationError } from '../../../src/utils/error.util';
import { authConfig } from '../../../src/config/auth.config';

// Mock auth config to control test environment
jest.mock('../../../src/config/auth.config', () => ({
  authConfig: {
    jwtSecret: 'test-secret-key-with-minimum-length',
    accessTokenExpiration: '1h',
    algorithm: 'HS256'
  }
}));

// Mock jsonwebtoken for specific test cases
jest.mock('jsonwebtoken', () => {
  const originalModule = jest.requireActual('jsonwebtoken');
  
  return {
    ...originalModule,
    verify: jest.fn().mockImplementation(originalModule.verify),
    sign: jest.fn().mockImplementation(originalModule.sign),
    decode: jest.fn().mockImplementation(originalModule.decode)
  };
});

// Import jsonwebtoken after mocking
import { verify, sign, decode, TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

// Define test data
const validPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
  sub: 'test-user-id',
  email: 'test@example.com',
  role: 'USER'
};

const invalidPayload = {
  sub: '',
  email: 'invalid-email',
  role: 'INVALID_ROLE'
};

const mockJwtSecret = 'test-secret-key-with-minimum-length';
const mockConfig = {
  jwtSecret: mockJwtSecret,
  accessTokenExpiration: '1h',
  algorithm: 'HS256'
};

describe('JWT Utility Tests', () => {
  let validToken: string;
  
  beforeEach(() => {
    // Reset mocks and restore implementations
    jest.clearAllMocks();
    (verify as jest.Mock).mockImplementation(jest.requireActual('jsonwebtoken').verify);
    (sign as jest.Mock).mockImplementation(jest.requireActual('jsonwebtoken').sign);
    (decode as jest.Mock).mockImplementation(jest.requireActual('jsonwebtoken').decode);
    
    // Create a valid token for tests that need one
    const jwtModule = jest.requireActual('jsonwebtoken');
    validToken = jwtModule.sign(
      { ...validPayload, iat: Math.floor(Date.now() / 1000) },
      mockJwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Test suite for generateToken function
  describe('generateToken', () => {
    test('Should generate valid JWT token with correct payload and signature', () => {
      const token = generateToken(validPayload);
      
      // Token structure validation
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Check token parts
      const parts = token.split('.');
      expect(parts).toHaveLength(3); // header.payload.signature format
      
      // Decode and validate payload
      const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      expect(decodedPayload).toHaveProperty('sub', validPayload.sub);
      expect(decodedPayload).toHaveProperty('email', validPayload.email);
      expect(decodedPayload).toHaveProperty('role', validPayload.role);
      expect(decodedPayload).toHaveProperty('iat');
      
      // Verify it can be verified using jsonwebtoken
      const verifiedPayload = jest.requireActual('jsonwebtoken').verify(
        token, 
        mockJwtSecret
      );
      expect(verifiedPayload.sub).toBe(validPayload.sub);
    });

    test('Should throw error for missing required payload fields', () => {
      // Test with missing required fields
      const incompletePayloads = [
        {},                                        // Empty payload
        { sub: validPayload.sub },                 // Missing email and role
        { email: validPayload.email },             // Missing sub and role
        { role: validPayload.role },               // Missing sub and email
        { sub: validPayload.sub, email: validPayload.email }, // Missing role
        { sub: validPayload.sub, role: validPayload.role },   // Missing email
        { email: validPayload.email, role: validPayload.role } // Missing sub
      ];
      
      incompletePayloads.forEach(payload => {
        expect(() => generateToken(payload as any)).toThrow(AuthenticationError);
        
        try {
          generateToken(payload as any);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
          expect(error.message).toBe('TOKEN_INVALID');
          expect(error.details).toHaveProperty('message', 'Missing required fields in token payload');
        }
      });
    });

    test('Should set correct expiration time based on configuration', () => {
      const token = generateToken(validPayload);
      const decodedToken = jest.requireActual('jsonwebtoken').verify(token, mockJwtSecret) as JwtPayload;
      
      const iat = decodedToken.iat;
      const exp = decodedToken.exp;
      
      // With 1h expiration, exp should be iat + 3600 seconds
      expect(exp).toBe(iat + 3600);
    });

    test('Should include all required JWT header fields', () => {
      const token = generateToken(validPayload);
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      
      // Check header fields
      expect(header).toHaveProperty('alg', 'HS256');
      expect(header).toHaveProperty('typ', 'JWT');
    });

    test('Should use correct signing algorithm', () => {
      const token = generateToken(validPayload);
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      
      expect(header.alg).toBe('HS256');
    });

    test('Should throw error for invalid email format', () => {
      const invalidEmails = [
        'invalid-email',
        'user@',
        '@domain.com',
        'user@domain'
      ];
      
      invalidEmails.forEach(email => {
        const invalidEmailPayload = { ...validPayload, email };
        
        expect(() => generateToken(invalidEmailPayload)).toThrow(AuthenticationError);
        
        try {
          generateToken(invalidEmailPayload);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
          expect(error.message).toBe('TOKEN_INVALID');
          expect(error.details).toHaveProperty('message', 'Invalid email format');
        }
      });
    });

    test('Should throw error for invalid subject format', () => {
      const invalidSubjects = ['', '   ', '\t', '\n'];
      
      invalidSubjects.forEach(sub => {
        const invalidSubPayload = { ...validPayload, sub };
        
        expect(() => generateToken(invalidSubPayload)).toThrow(AuthenticationError);
        
        try {
          generateToken(invalidSubPayload);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
          expect(error.message).toBe('TOKEN_INVALID');
          expect(error.details).toHaveProperty('message', 'Invalid subject format');
        }
      });
    });

    test('Should handle special characters in payload properly', () => {
      const specialCharsPayload = {
        ...validPayload,
        sub: 'user+with.special@chars',
        email: 'special+chars@example.com'
      };
      
      const token = generateToken(specialCharsPayload);
      const verifiedPayload = jest.requireActual('jsonwebtoken').verify(token, mockJwtSecret);
      
      expect(verifiedPayload.sub).toBe(specialCharsPayload.sub);
      expect(verifiedPayload.email).toBe(specialCharsPayload.email);
    });

    test('Should handle JWT sign errors appropriately', () => {
      // Mock sign to throw an error
      (sign as jest.Mock).mockImplementation(() => {
        throw new JsonWebTokenError('Error signing token');
      });
      
      expect(() => generateToken(validPayload)).toThrow(AuthenticationError);
      
      try {
        generateToken(validPayload);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Token generation failed');
      }
    });
  });

  // Test suite for verifyToken function
  describe('verifyToken', () => {
    test('Should verify valid token and return complete payload', () => {
      const payload = verifyToken(validToken);
      
      // Check payload properties
      expect(payload).toHaveProperty('sub', validPayload.sub);
      expect(payload).toHaveProperty('email', validPayload.email);
      expect(payload).toHaveProperty('role', validPayload.role);
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
    });

    test('Should detect and reject expired tokens', () => {
      // Mock verify to throw TokenExpiredError
      (verify as jest.Mock).mockImplementation(() => {
        const expiredAt = new Date();
        throw new TokenExpiredError('jwt expired', expiredAt);
      });
      
      expect(() => verifyToken(validToken)).toThrow(AuthenticationError);
      
      try {
        verifyToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_EXPIRED');
        expect(error.details).toHaveProperty('message', 'Token has expired');
        expect(error.details).toHaveProperty('expiredAt');
      }
    });

    test('Should detect and reject invalid signatures', () => {
      // Mock verify to throw JsonWebTokenError for invalid signature
      (verify as jest.Mock).mockImplementation(() => {
        throw new JsonWebTokenError('invalid signature');
      });
      
      expect(() => verifyToken(validToken)).toThrow(AuthenticationError);
      
      try {
        verifyToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Invalid token');
        expect(error.details).toHaveProperty('error', 'invalid signature');
      }
    });

    test('Should handle malformed token formats', () => {
      const malformedTokens = [
        'not-a-jwt-token',
        'header.payload', // Missing signature
        'header..signature', // Empty payload
        '.payload.signature', // Empty header
        'header.payload.', // Empty signature
        'header.payload.signature.extra', // Too many segments
        '' // Empty token
      ];
      
      malformedTokens.forEach(token => {
        expect(() => verifyToken(token)).toThrow(AuthenticationError);
        
        if (token === '') {
          try {
            verifyToken(token);
          } catch (error) {
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.message).toBe('TOKEN_MISSING');
          }
        } else {
          try {
            verifyToken(token);
          } catch (error) {
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.message).toBe('TOKEN_INVALID');
          }
        }
      });
    });

    test('Should throw error for token with missing required fields', () => {
      // Mock verify to return incomplete payload
      (verify as jest.Mock).mockImplementation(() => {
        return {
          payload: { sub: 'test-id', iat: 123456789, exp: 123456789 + 3600 },
          header: { alg: 'HS256', typ: 'JWT' }
        };
      });
      
      expect(() => verifyToken(validToken)).toThrow(AuthenticationError);
      
      try {
        verifyToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Token payload is missing required fields');
      }
    });

    test('Should handle missing tokens appropriately', () => {
      const emptyTokens: any[] = ['', null, undefined, 123, true, {}];
      
      emptyTokens.forEach(token => {
        expect(() => verifyToken(token)).toThrow(AuthenticationError);
        
        try {
          verifyToken(token);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
          expect(error.message).toBe('TOKEN_MISSING');
          expect(error.details).toHaveProperty('message', 'Token must be a non-empty string');
        }
      });
    });

    test('Should detect token tampering', () => {
      // Generate a valid token
      const token = generateToken(validPayload);
      
      // Tamper with the token (modify the payload)
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.role = 'ADMIN'; // Elevate privileges
      
      const tamperedPayload = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=+$/, ''); // Remove base64 padding
      
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      // Verification should fail
      expect(() => verifyToken(tamperedToken)).toThrow(AuthenticationError);
    });

    test('Should validate signing algorithm', () => {
      // This test is implicit since we restrict algorithms in verifyToken
      // but we can still verify it's using the right function parameters
      const spy = jest.spyOn(jest.requireActual('jsonwebtoken'), 'verify');
      
      try {
        verifyToken(validToken);
      } catch (error) {
        // Ignore errors
      }
      
      // Verify that the verify function was called with algorithms: ['HS256']
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          algorithms: ['HS256'],
          complete: true
        })
      );
      
      spy.mockRestore();
    });

    test('Should handle unexpected errors during verification', () => {
      // Mock verify to throw a generic error
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      expect(() => verifyToken(validToken)).toThrow(AuthenticationError);
      
      try {
        verifyToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('UNAUTHORIZED');
        expect(error.details).toHaveProperty('message', 'Token verification failed due to an unexpected error');
        expect(error.details).toHaveProperty('error', 'Unexpected error');
      }
    });
  });

  // Test suite for decodeToken function
  describe('decodeToken', () => {
    test('Should decode valid token without verification', () => {
      const payload = decodeToken(validToken);
      
      // Check payload contents
      expect(payload).toHaveProperty('sub', validPayload.sub);
      expect(payload).toHaveProperty('email', validPayload.email);
      expect(payload).toHaveProperty('role', validPayload.role);
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
    });

    test('Should decode expired tokens for inspection', () => {
      // Create an expired token (using a mock that would fail verification)
      // but should still be decodable
      
      // First mock verify to simulate an expired token
      (verify as jest.Mock).mockImplementation(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });
      
      // This token would fail verification
      expect(() => verifyToken(validToken)).toThrow(AuthenticationError);
      
      // But should still be decodable
      const decodedPayload = decodeToken(validToken);
      expect(decodedPayload).toHaveProperty('sub', validPayload.sub);
      expect(decodedPayload).toHaveProperty('email', validPayload.email);
    });

    test('Should handle malformed token formats', () => {
      const malformedTokens = [
        'not-a-jwt-token',
        'header.payload', // Missing signature
        'header..signature', // Empty payload
        '.payload.signature', // Empty header
        'header.payload.', // Empty signature
        'header.payload.signature.extra', // Too many segments
        '' // Empty token
      ];
      
      malformedTokens.forEach(token => {
        expect(() => decodeToken(token)).toThrow(AuthenticationError);
        
        if (token === '') {
          try {
            decodeToken(token);
          } catch (error) {
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.message).toBe('TOKEN_MISSING');
          }
        } else {
          try {
            decodeToken(token);
          } catch (error) {
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.message).toBe('TOKEN_INVALID');
          }
        }
      });
    });

    test('Should validate decoded payload structure', () => {
      // Mock decode to return incomplete payload
      (decode as jest.Mock).mockImplementation(() => ({
        payload: { sub: 'test-id', iat: 123456789, exp: 123456789 + 3600 }, // Missing email and role
        header: { alg: 'HS256', typ: 'JWT' }
      }));
      
      expect(() => decodeToken(validToken)).toThrow(AuthenticationError);
      
      try {
        decodeToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Decoded token missing required fields');
      }
    });

    test('Should handle missing tokens appropriately', () => {
      const emptyTokens: any[] = ['', null, undefined, 123, true, {}];
      
      emptyTokens.forEach(token => {
        expect(() => decodeToken(token)).toThrow(AuthenticationError);
        
        try {
          decodeToken(token);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
          expect(error.message).toBe('TOKEN_MISSING');
          expect(error.details).toHaveProperty('message', 'Token must be a non-empty string');
        }
      });
    });

    test('Should decode tampered token without validation', () => {
      // Generate a valid token
      const token = generateToken(validPayload);
      
      // Tamper with the token (modify the payload)
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.role = 'ADMIN'; // Elevate privileges
      
      const tamperedPayload = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=+$/, ''); // Remove base64 padding
      
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      // Verification would fail
      expect(() => verifyToken(tamperedToken)).toThrow(AuthenticationError);
      
      // But decode should still work
      const decodedPayload = decodeToken(tamperedToken);
      
      // And should show the tampered data
      expect(decodedPayload.role).toBe('ADMIN');
    });

    test('Should handle decode returning null', () => {
      // Mock decode to return null
      (decode as jest.Mock).mockImplementation(() => null);
      
      expect(() => decodeToken(validToken)).toThrow(AuthenticationError);
      
      try {
        decodeToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Failed to decode token');
      }
    });

    test('Should handle decode returning string', () => {
      // Mock decode to return string
      (decode as jest.Mock).mockImplementation(() => 'invalid-token');
      
      expect(() => decodeToken(validToken)).toThrow(AuthenticationError);
      
      try {
        decodeToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Failed to decode token');
      }
    });

    test('Should handle unexpected errors during decoding', () => {
      // Mock decode to throw a generic error
      (decode as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected decode error');
      });
      
      expect(() => decodeToken(validToken)).toThrow(AuthenticationError);
      
      try {
        decodeToken(validToken);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('TOKEN_INVALID');
        expect(error.details).toHaveProperty('message', 'Token decoding failed');
        expect(error.details).toHaveProperty('error', 'Unexpected decode error');
      }
    });
  });
});