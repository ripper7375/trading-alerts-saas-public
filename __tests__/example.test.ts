// Example Jest test for Trading Alerts SaaS
// Simple tests without JSX to ensure Jest is working

// Example utility function to test
export const addNumbers = (a: number, b: number): number => {
  return a + b;
};

export const multiplyNumbers = (a: number, b: number): number => {
  return a * b;
};

export const isEven = (num: number): boolean => {
  return num % 2 === 0;
};

describe('Example Tests - Utility Functions', () => {
  describe('addNumbers', () => {
    it('should add two positive numbers correctly', () => {
      expect(addNumbers(2, 3)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(addNumbers(-1, 5)).toBe(4);
    });

    it('should handle zero', () => {
      expect(addNumbers(0, 0)).toBe(0);
    });
  });

  describe('multiplyNumbers', () => {
    it('should multiply two positive numbers', () => {
      expect(multiplyNumbers(3, 4)).toBe(12);
    });

    it('should handle multiplication by zero', () => {
      expect(multiplyNumbers(5, 0)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(multiplyNumbers(-2, 3)).toBe(-6);
    });
  });

  describe('isEven', () => {
    it('should return true for even numbers', () => {
      expect(isEven(2)).toBe(true);
      expect(isEven(4)).toBe(true);
      expect(isEven(0)).toBe(true);
    });

    it('should return false for odd numbers', () => {
      expect(isEven(1)).toBe(false);
      expect(isEven(3)).toBe(false);
      expect(isEven(7)).toBe(false);
    });
  });
});

describe('Async Tests', () => {
  it('should handle async operations', async () => {
    const asyncFunction = () => Promise.resolve('success');
    const result = await asyncFunction();
    expect(result).toBe('success');
  });

  it('should handle rejected promises', async () => {
    const asyncError = () => Promise.reject(new Error('test error'));
    await expect(asyncError()).rejects.toThrow('test error');
  });
});

describe('Array and Object Tests', () => {
  it('should test array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr).toContain(3);
    expect(arr[0]).toBe(1);
  });

  it('should test object properties', () => {
    const obj = { name: 'Test', value: 42 };
    expect(obj).toHaveProperty('name');
    expect(obj.name).toBe('Test');
    expect(obj.value).toBe(42);
  });
});
