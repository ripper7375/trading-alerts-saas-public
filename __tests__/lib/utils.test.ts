import {
  cn,
  formatCurrency,
  formatDate,
  truncate,
  sleep,
  generateId,
} from '@/lib/utils';

describe('Utils - cn (className merger)', () => {
  it('should merge class names correctly', () => {
    const result = cn('base-class', 'additional-class');
    expect(result).toContain('base-class');
    expect(result).toContain('additional-class');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'conditional', false && 'not-included');
    expect(result).toContain('conditional');
    expect(result).not.toContain('not-included');
  });

  it('should handle undefined and null', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });

  it('should handle empty strings', () => {
    const result = cn('base', '', 'extra');
    expect(result).toContain('base');
    expect(result).toContain('extra');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toContain('class1');
    expect(result).toContain('class2');
    expect(result).toContain('class3');
  });
});

describe('Utils - formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle negative numbers', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should handle decimal places correctly', () => {
    expect(formatCurrency(99.99)).toBe('$99.99');
    expect(formatCurrency(99.9)).toBe('$99.90');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(99.999)).toBe('$100.00');
  });
});

describe('Utils - formatDate', () => {
  it('should format date object correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toMatch(/Jan 15, 2024/);
  });

  it('should format date string correctly', () => {
    const result = formatDate('2024-12-25');
    expect(result).toContain('2024');
    expect(result).toContain('Dec');
    expect(result).toContain('25');
  });

  it('should handle ISO date strings', () => {
    const result = formatDate('2024-03-15T12:00:00Z');
    expect(result).toMatch(/Mar 15, 2024/);
  });

  it('should throw error for invalid date', () => {
    expect(() => formatDate('invalid-date')).toThrow('Invalid date provided');
  });

  it('should throw error for empty string', () => {
    expect(() => formatDate('')).toThrow('Invalid date provided');
  });
});

describe('Utils - truncate', () => {
  it('should truncate long text', () => {
    const text = 'This is a very long text that needs to be truncated';
    const result = truncate(text, 20);
    expect(result).toBe('This is a very long ...');
    expect(result.length).toBe(23); // 20 chars + '...'
  });

  it('should not truncate short text', () => {
    const text = 'Short text';
    const result = truncate(text, 20);
    expect(result).toBe('Short text');
  });

  it('should handle exact length', () => {
    const text = 'Exactly 20 chars msg';
    const result = truncate(text, 20);
    expect(result).toBe('Exactly 20 chars msg');
  });

  it('should handle empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('should handle zero length', () => {
    expect(truncate('Hello', 0)).toBe('...');
  });
});

describe('Utils - sleep', () => {
  it('should delay execution', async () => {
    const start = Date.now();
    await sleep(100);
    const end = Date.now();
    const elapsed = end - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
  });

  it('should return a promise', () => {
    const result = sleep(10);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should resolve after specified time', async () => {
    const mockFn = jest.fn();
    await sleep(50);
    mockFn();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('Utils - generateId', () => {
  it('should generate a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('should generate non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should generate IDs with reasonable length', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(5);
    expect(id.length).toBeLessThan(15);
  });

  it('should generate alphanumeric IDs', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
