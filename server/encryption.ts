import { createCipheriv, createDecipheriv, randomBytes, createHash, CipherGCM, DecipherGCM } from 'crypto';

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

class EncryptionService {
  private readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16   // 128 bits
  };

  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set. This is required for PHI protection.');
    }
    
    // Derive a consistent 256-bit key from the environment variable
    return createHash('sha256').update(key).digest();
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param plaintext The data to encrypt
   * @returns Encrypted data with IV and authentication tag
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      const key = this.getEncryptionKey();
      const iv = randomBytes(this.config.ivLength);
      
      const cipher = createCipheriv(this.config.algorithm, key, iv) as CipherGCM;
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('[Encryption] Error encrypting data:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   * @param encryptedData The encrypted data object
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const key = this.getEncryptionKey();
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = createDecipheriv(this.config.algorithm, key, iv) as DecipherGCM;
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[Encryption] Error decrypting data:', error);
      throw new Error('Failed to decrypt sensitive data - possible data corruption or invalid key');
    }
  }

  /**
   * Encrypt OAuth tokens for secure database storage
   * @param tokens The OAuth tokens to encrypt
   * @returns Encrypted token data
   */
  encryptOAuthTokens(tokens: {
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
    token_type?: string | null;
    scope?: string | null;
  }): string {
    const tokenData = JSON.stringify(tokens);
    const encrypted = this.encrypt(tokenData);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt OAuth tokens from database storage
   * @param encryptedTokens The encrypted token string from database
   * @returns Decrypted OAuth tokens
   */
  decryptOAuthTokens(encryptedTokens: string): {
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
    token_type?: string | null;
    scope?: string | null;
  } {
    const encryptedData: EncryptedData = JSON.parse(encryptedTokens);
    const decryptedData = this.decrypt(encryptedData);
    return JSON.parse(decryptedData);
  }

  /**
   * Securely wipe sensitive data from memory
   * @param sensitiveString String containing sensitive data
   */
  wipeSensitiveData(sensitiveString: string): void {
    // Overwrite the string content (limited effectiveness in JavaScript but good practice)
    if (sensitiveString && typeof sensitiveString === 'string') {
      // Note: In JavaScript, strings are immutable, so this is more symbolic
      // In production, consider using Buffer.alloc and Buffer.fill for more secure wiping
      try {
        // At least zero out any references
        (sensitiveString as any) = null;
      } catch (error) {
        // Ignore errors in memory wiping
      }
    }
  }

  /**
   * Generate a secure random key for the ENCRYPTION_KEY environment variable
   * This should be run once during initial setup
   */
  static generateEncryptionKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Validate encryption configuration and key
   */
  validateEncryption(): { valid: boolean; error?: string } {
    try {
      // Test encryption/decryption
      const testData = 'test-encryption-validation';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      if (decrypted !== testData) {
        return { valid: false, error: 'Encryption validation failed - decrypted data does not match' };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown encryption validation error' 
      };
    }
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();

// Audit logging for encryption operations
export class EncryptionAuditLogger {
  private static logEntry(operation: string, success: boolean, error?: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      operation: `encryption_${operation}`,
      success,
      error: error ? error.substring(0, 100) : undefined, // Truncate error messages
      context: 'PHI_protection'
    };
    
    console.log(`[Encryption Audit] ${JSON.stringify(logData)}`);
  }

  static logEncryption(success: boolean, error?: string): void {
    this.logEntry('encrypt', success, error);
  }

  static logDecryption(success: boolean, error?: string): void {
    this.logEntry('decrypt', success, error);
  }

  static logKeyGeneration(success: boolean, error?: string): void {
    this.logEntry('key_generation', success, error);
  }

  static logValidation(success: boolean, error?: string): void {
    this.logEntry('validation', success, error);
  }
}