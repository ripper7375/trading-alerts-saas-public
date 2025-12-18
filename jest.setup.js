// Jest setup file for Next.js 15 with TypeScript
// This file runs before each test file

// Polyfill TextEncoder/TextDecoder for jsdom environment
// Required by packages like resend and @react-email/render
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill Web Streams API for jsdom environment
// Required by undici and other packages that use Web Streams
// Note: stream/web is available in Node.js 16.5+ but not exposed to jsdom by default
if (typeof global.ReadableStream === 'undefined') {
  const {
    ReadableStream,
    WritableStream,
    TransformStream,
  } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
}

// Polyfill Web API globals (Request, Response, Headers, etc.) for jsdom environment
// Required by next/server and other packages that use Web APIs
// Note: These are available in Node.js 18+ but not exposed to jsdom by default
if (typeof global.Request === 'undefined') {
  const { Request, Response, Headers, fetch } = require('undici');
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
  global.fetch = fetch;
}

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
