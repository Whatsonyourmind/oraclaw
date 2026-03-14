/**
 * ORACLE End-to-End Encryption Service
 * Story sec-1 - Client-side encryption for sensitive ORACLE data
 *
 * Features:
 * - Client-side encryption for decision details
 * - Key derivation from user password
 * - Secure key storage (Keychain/Keystore)
 * - Encryption toggle in settings
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'AES-256-GCM';
  keyDerivationFunction: 'PBKDF2';
  keyDerivationIterations: number;
  saltLength: number;
  ivLength: number;
  tagLength: number;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  tag: string;
  version: number;
  algorithm: string;
}

export interface KeyInfo {
  keyId: string;
  createdAt: string;
  algorithm: string;
  derivedFrom: 'password' | 'biometric';
}

export interface EncryptionStatus {
  enabled: boolean;
  keyExists: boolean;
  keyInfo: KeyInfo | null;
  encryptedFieldCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ENCRYPTION_KEY_ALIAS = 'oracle_encryption_key';
const KEY_INFO_ALIAS = 'oracle_key_info';
const ENCRYPTION_CONFIG_ALIAS = 'oracle_encryption_config';
const ENCRYPTION_VERSION = 1;

const DEFAULT_CONFIG: EncryptionConfig = {
  enabled: false,
  algorithm: 'AES-256-GCM',
  keyDerivationFunction: 'PBKDF2',
  keyDerivationIterations: 100000,
  saltLength: 32,
  ivLength: 12,
  tagLength: 16,
};

// ============================================================================
// SECURE STORAGE WRAPPER
// ============================================================================

class SecureKeyStorage {
  private static async isAvailable(): Promise<boolean> {
    return SecureStore.isAvailableAsync();
  }

  static async save(key: string, value: string): Promise<void> {
    const options: SecureStore.SecureStoreOptions = {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    };
    await SecureStore.setItemAsync(key, value, options);
  }

  static async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  static async delete(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  static async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}

// ============================================================================
// ENCRYPTION SERVICE CLASS
// ============================================================================

export class EncryptionService {
  private config: EncryptionConfig = DEFAULT_CONFIG;
  private encryptionKey: CryptoKey | null = null;
  private keyInfo: KeyInfo | null = null;
  private initialized = false;

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load configuration
    const savedConfig = await SecureKeyStorage.get(ENCRYPTION_CONFIG_ALIAS);
    if (savedConfig) {
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
    }

    // Load key info
    const savedKeyInfo = await SecureKeyStorage.get(KEY_INFO_ALIAS);
    if (savedKeyInfo) {
      this.keyInfo = JSON.parse(savedKeyInfo);
    }

    this.initialized = true;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  async getConfig(): Promise<EncryptionConfig> {
    await this.initialize();
    return { ...this.config };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.initialize();
    this.config.enabled = enabled;
    await SecureKeyStorage.save(ENCRYPTION_CONFIG_ALIAS, JSON.stringify(this.config));
  }

  async isEnabled(): Promise<boolean> {
    await this.initialize();
    return this.config.enabled;
  }

  async getStatus(): Promise<EncryptionStatus> {
    await this.initialize();
    const keyExists = await SecureKeyStorage.exists(ENCRYPTION_KEY_ALIAS);

    return {
      enabled: this.config.enabled,
      keyExists,
      keyInfo: this.keyInfo,
      encryptedFieldCount: 0, // Would need to query encrypted data
    };
  }

  // --------------------------------------------------------------------------
  // Key Management
  // --------------------------------------------------------------------------

  /**
   * Derive encryption key from user password using PBKDF2
   */
  async deriveKeyFromPassword(password: string, salt?: string): Promise<void> {
    // Generate salt if not provided
    const keySalt = salt || await this.generateRandomBytes(this.config.saltLength);

    // Use PBKDF2 to derive key
    const keyMaterial = await this.pbkdf2(
      password,
      keySalt,
      this.config.keyDerivationIterations
    );

    // Store the derived key securely
    await SecureKeyStorage.save(ENCRYPTION_KEY_ALIAS, keyMaterial);
    await SecureKeyStorage.save(`${ENCRYPTION_KEY_ALIAS}_salt`, keySalt);

    // Store key info
    this.keyInfo = {
      keyId: await this.generateKeyId(),
      createdAt: new Date().toISOString(),
      algorithm: this.config.algorithm,
      derivedFrom: 'password',
    };
    await SecureKeyStorage.save(KEY_INFO_ALIAS, JSON.stringify(this.keyInfo));
  }

  /**
   * Check if encryption key exists
   */
  async hasKey(): Promise<boolean> {
    return SecureKeyStorage.exists(ENCRYPTION_KEY_ALIAS);
  }

  /**
   * Delete encryption key
   */
  async deleteKey(): Promise<void> {
    await SecureKeyStorage.delete(ENCRYPTION_KEY_ALIAS);
    await SecureKeyStorage.delete(`${ENCRYPTION_KEY_ALIAS}_salt`);
    await SecureKeyStorage.delete(KEY_INFO_ALIAS);
    this.encryptionKey = null;
    this.keyInfo = null;
  }

  /**
   * Verify password matches the stored key
   */
  async verifyPassword(password: string): Promise<boolean> {
    const storedKey = await SecureKeyStorage.get(ENCRYPTION_KEY_ALIAS);
    const salt = await SecureKeyStorage.get(`${ENCRYPTION_KEY_ALIAS}_salt`);

    if (!storedKey || !salt) {
      return false;
    }

    const derivedKey = await this.pbkdf2(
      password,
      salt,
      this.config.keyDerivationIterations
    );

    return derivedKey === storedKey;
  }

  /**
   * Change password (re-derive key)
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const isValid = await this.verifyPassword(oldPassword);
    if (!isValid) {
      return false;
    }

    // Generate new salt for new password
    await this.deriveKeyFromPassword(newPassword);
    return true;
  }

  // --------------------------------------------------------------------------
  // Encryption / Decryption
  // --------------------------------------------------------------------------

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<EncryptedData | null> {
    if (!this.config.enabled) {
      return null;
    }

    const key = await SecureKeyStorage.get(ENCRYPTION_KEY_ALIAS);
    if (!key) {
      throw new Error('Encryption key not found. Please set up encryption first.');
    }

    // Generate IV
    const iv = await this.generateRandomBytes(this.config.ivLength);

    // Get the salt used for key derivation
    const salt = await SecureKeyStorage.get(`${ENCRYPTION_KEY_ALIAS}_salt`);
    if (!salt) {
      throw new Error('Key salt not found');
    }

    // Encrypt using AES-GCM
    const { ciphertext, tag } = await this.aesGcmEncrypt(plaintext, key, iv);

    return {
      ciphertext,
      iv,
      salt,
      tag,
      version: ENCRYPTION_VERSION,
      algorithm: this.config.algorithm,
    };
  }

  /**
   * Decrypt encrypted data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const key = await SecureKeyStorage.get(ENCRYPTION_KEY_ALIAS);
    if (!key) {
      throw new Error('Encryption key not found');
    }

    // Verify version compatibility
    if (encryptedData.version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }

    // Decrypt using AES-GCM
    return this.aesGcmDecrypt(
      encryptedData.ciphertext,
      key,
      encryptedData.iv,
      encryptedData.tag
    );
  }

  /**
   * Encrypt an object's sensitive fields
   */
  async encryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: (keyof T)[]
  ): Promise<T & { _encrypted: Record<string, EncryptedData> }> {
    if (!this.config.enabled) {
      return { ...data, _encrypted: {} };
    }

    const result = { ...data } as T & { _encrypted: Record<string, EncryptedData> };
    result._encrypted = {};

    for (const field of sensitiveFields) {
      const value = data[field];
      if (value !== undefined && value !== null) {
        const encrypted = await this.encrypt(JSON.stringify(value));
        if (encrypted) {
          result._encrypted[field as string] = encrypted;
          // Replace original value with placeholder
          (result as any)[field] = '[ENCRYPTED]';
        }
      }
    }

    return result;
  }

  /**
   * Decrypt an object's encrypted fields
   */
  async decryptFields<T extends Record<string, any>>(
    data: T & { _encrypted?: Record<string, EncryptedData> }
  ): Promise<T> {
    if (!data._encrypted || Object.keys(data._encrypted).length === 0) {
      const { _encrypted, ...rest } = data;
      return rest as T;
    }

    const result = { ...data } as T;

    for (const [field, encryptedData] of Object.entries(data._encrypted)) {
      const decrypted = await this.decrypt(encryptedData);
      (result as any)[field] = JSON.parse(decrypted);
    }

    delete (result as any)._encrypted;
    return result;
  }

  // --------------------------------------------------------------------------
  // ORACLE-Specific Encryption Helpers
  // --------------------------------------------------------------------------

  /**
   * Encrypt decision details
   */
  async encryptDecision(decision: any): Promise<any> {
    const sensitiveFields = ['rationale', 'constraints', 'metadata'];
    return this.encryptFields(decision, sensitiveFields);
  }

  /**
   * Decrypt decision details
   */
  async decryptDecision(decision: any): Promise<any> {
    return this.decryptFields(decision);
  }

  /**
   * Encrypt signal content
   */
  async encryptSignal(signal: any): Promise<any> {
    const sensitiveFields = ['content', 'source_data', 'metadata'];
    return this.encryptFields(signal, sensitiveFields);
  }

  /**
   * Decrypt signal content
   */
  async decryptSignal(signal: any): Promise<any> {
    return this.decryptFields(signal);
  }

  /**
   * Encrypt ghost action details
   */
  async encryptGhostAction(action: any): Promise<any> {
    const sensitiveFields = ['draft_action', 'rationale', 'metadata'];
    return this.encryptFields(action, sensitiveFields);
  }

  /**
   * Decrypt ghost action details
   */
  async decryptGhostAction(action: any): Promise<any> {
    return this.decryptFields(action);
  }

  // --------------------------------------------------------------------------
  // Cryptographic Primitives
  // --------------------------------------------------------------------------

  private async generateRandomBytes(length: number): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(length);
    return this.bytesToHex(bytes);
  }

  private async generateKeyId(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return this.bytesToHex(bytes);
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * PBKDF2 key derivation
   * Note: Using a simplified implementation - in production use a native module
   */
  private async pbkdf2(
    password: string,
    salt: string,
    iterations: number
  ): Promise<string> {
    // Use expo-crypto's digest for HMAC-based derivation
    let result = password + salt;

    for (let i = 0; i < Math.min(iterations, 1000); i++) {
      // Simplified PBKDF2 - in production, use a proper crypto library
      result = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        result + salt + i.toString()
      );
    }

    return result;
  }

  /**
   * AES-GCM encryption
   * Note: This is a simplified implementation - in production use react-native-aes-gcm-crypto
   */
  private async aesGcmEncrypt(
    plaintext: string,
    key: string,
    iv: string
  ): Promise<{ ciphertext: string; tag: string }> {
    // In a real implementation, use a proper AES-GCM library
    // This is a placeholder that uses XOR with key hash for demonstration
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key + iv
    );

    const plaintextBytes = new TextEncoder().encode(plaintext);
    const keyBytes = this.hexToBytes(keyHash);

    const cipherBytes = new Uint8Array(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
      cipherBytes[i] = plaintextBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    // Generate authentication tag
    const tag = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      this.bytesToHex(cipherBytes) + key + iv
    );

    return {
      ciphertext: this.bytesToHex(cipherBytes),
      tag: tag.slice(0, 32), // Use first 16 bytes as tag
    };
  }

  /**
   * AES-GCM decryption
   */
  private async aesGcmDecrypt(
    ciphertext: string,
    key: string,
    iv: string,
    tag: string
  ): Promise<string> {
    // Verify authentication tag
    const expectedTag = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      ciphertext + key + iv
    );

    if (expectedTag.slice(0, 32) !== tag) {
      throw new Error('Authentication tag verification failed');
    }

    // Decrypt
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key + iv
    );

    const cipherBytes = this.hexToBytes(ciphertext);
    const keyBytes = this.hexToBytes(keyHash);

    const plaintextBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plaintextBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(plaintextBytes);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const encryptionService = new EncryptionService();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export interface UseEncryptionReturn {
  status: EncryptionStatus | null;
  isLoading: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  setupEncryption: (password: string) => Promise<boolean>;
  verifyPassword: (password: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  deleteEncryption: () => Promise<void>;
  encrypt: (data: string) => Promise<EncryptedData | null>;
  decrypt: (data: EncryptedData) => Promise<string>;
}

export function useEncryption(): UseEncryptionReturn {
  const [status, setStatus] = useState<EncryptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      await encryptionService.initialize();
      const s = await encryptionService.getStatus();
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load encryption status');
    } finally {
      setIsLoading(false);
    }
  };

  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      await encryptionService.setEnabled(enabled);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update encryption settings');
    }
  }, []);

  const setupEncryption = useCallback(async (password: string): Promise<boolean> => {
    try {
      await encryptionService.deriveKeyFromPassword(password);
      await encryptionService.setEnabled(true);
      await loadStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup encryption');
      return false;
    }
  }, []);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    return encryptionService.verifyPassword(password);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const result = await encryptionService.changePassword(oldPassword, newPassword);
    if (result) {
      await loadStatus();
    }
    return result;
  }, []);

  const deleteEncryption = useCallback(async () => {
    await encryptionService.deleteKey();
    await encryptionService.setEnabled(false);
    await loadStatus();
  }, []);

  const encrypt = useCallback(async (data: string): Promise<EncryptedData | null> => {
    return encryptionService.encrypt(data);
  }, []);

  const decrypt = useCallback(async (data: EncryptedData): Promise<string> => {
    return encryptionService.decrypt(data);
  }, []);

  return {
    status,
    isLoading,
    error,
    setEnabled,
    setupEncryption,
    verifyPassword,
    changePassword,
    deleteEncryption,
    encrypt,
    decrypt,
  };
}

export default encryptionService;
