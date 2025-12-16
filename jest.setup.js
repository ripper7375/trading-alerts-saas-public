// Jest setup file for Next.js 15 with TypeScript
// This file runs before each test file

// Extend Jest matchers with @testing-library/jest-dom
import '@testing-library/jest-dom';

// Optional: Set timeout for all tests
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock';
process.env.MT5_API_URL = 'http://localhost:5000';

// Mock Next.js router (if needed in tests)
// jest.mock('next/navigation', () => ({
//   useRouter: () => ({
//     push: jest.fn(),
//     replace: jest.fn(),
//     prefetch: jest.fn(),
//     back: jest.fn(),
//     forward: jest.fn(),
//     refresh: jest.fn(),
//   }),
//   useSearchParams: () => ({}),
//   usePathname: () => '/',
// }));

// Mock Next.js image component (if needed in tests)
// jest.mock('next/image', () => ({
//   __esModule: true,
//   default: (props) => {
//     return <img {...props} />;
//   },
// }));

// Global test utilities can be added here
global.testUtils = {
  // Add any custom test utilities here
};

// Suppress console warnings in tests (optional)
// console.warn = jest.fn();
