/**
 * Tests for use-toast hook
 * @description Unit tests for toast notification management
 */

import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/use-toast';

describe('useToast Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('addToast', () => {
    it('should add a toast with required type', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Test Toast',
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Test Toast');
      expect(result.current.toasts[0].type).toBe('info');
    });

    it('should add a toast with success type', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'success',
          title: 'Success Toast',
        });
      });

      expect(result.current.toasts[0].type).toBe('success');
    });

    it('should add a toast with error type', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'error',
          title: 'Error Toast',
        });
      });

      expect(result.current.toasts[0].type).toBe('error');
    });

    it('should add a toast with custom duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Quick Toast',
          duration: 2000,
        });
      });

      expect(result.current.toasts[0].duration).toBe(2000);
    });

    it('should add multiple toasts', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' });
        result.current.addToast({ type: 'success', title: 'Toast 2' });
        result.current.addToast({ type: 'warning', title: 'Toast 3' });
      });

      expect(result.current.toasts).toHaveLength(3);
    });

    it('should generate unique IDs for each toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' });
        result.current.addToast({ type: 'info', title: 'Toast 2' });
      });

      expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
    });

    it('should add toast with description', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Toast Title',
          description: 'Toast description',
        });
      });

      expect(result.current.toasts[0].description).toBe('Toast description');
    });

    it('should return toast ID when adding', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string = '';
      act(() => {
        toastId = result.current.addToast({ type: 'info', title: 'Toast' });
      });

      expect(toastId).toBeDefined();
      expect(typeof toastId).toBe('string');
      expect(result.current.toasts[0].id).toBe(toastId);
    });
  });

  describe('removeToast', () => {
    it('should remove a toast by ID', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string = '';
      act(() => {
        toastId = result.current.addToast({ type: 'info', title: 'Toast to remove' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.removeToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should only remove the specified toast', () => {
      const { result } = renderHook(() => useToast());

      let firstId: string = '';
      act(() => {
        firstId = result.current.addToast({ type: 'info', title: 'Toast 1' });
        result.current.addToast({ type: 'info', title: 'Toast 2' });
      });

      act(() => {
        result.current.removeToast(firstId);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 2');
    });
  });

  describe('clearToasts', () => {
    it('should remove all toasts', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({ type: 'info', title: 'Toast 1' });
        result.current.addToast({ type: 'success', title: 'Toast 2' });
        result.current.addToast({ type: 'error', title: 'Toast 3' });
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.clearToasts();
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss toast after duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Auto-dismiss toast',
          duration: 3000,
        });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should not auto-dismiss when duration is 0', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Persistent toast',
          duration: 0,
        });
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.toasts).toHaveLength(1);
    });

    it('should use default 5 second duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({
          type: 'info',
          title: 'Default duration toast',
        });
      });

      expect(result.current.toasts[0].duration).toBe(5000);
    });
  });

  describe('convenience methods', () => {
    it('should add success toast via success method', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success('Success message');
      });

      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toasts[0].title).toBe('Success message');
    });

    it('should add success toast with description', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success('Success', 'Details here');
      });

      expect(result.current.toasts[0].description).toBe('Details here');
    });

    it('should add error toast via error method', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.error('Error message');
      });

      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[0].title).toBe('Error message');
    });

    it('should add warning toast via warning method', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.warning('Warning message');
      });

      expect(result.current.toasts[0].type).toBe('warning');
      expect(result.current.toasts[0].title).toBe('Warning message');
    });

    it('should add info toast via info method', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.info('Info message');
      });

      expect(result.current.toasts[0].type).toBe('info');
      expect(result.current.toasts[0].title).toBe('Info message');
    });
  });

  describe('max toasts limit', () => {
    it('should limit toasts to maximum of 5', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addToast({ type: 'info', title: `Toast ${i}` });
        }
      });

      expect(result.current.toasts).toHaveLength(5);
    });

    it('should keep newest toasts when limit exceeded', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        for (let i = 0; i < 7; i++) {
          result.current.addToast({ type: 'info', title: `Toast ${i}` });
        }
      });

      expect(result.current.toasts).toHaveLength(5);
      // Should have toasts 2-6 (newest 5)
      expect(result.current.toasts[0].title).toBe('Toast 2');
      expect(result.current.toasts[4].title).toBe('Toast 6');
    });
  });
});
