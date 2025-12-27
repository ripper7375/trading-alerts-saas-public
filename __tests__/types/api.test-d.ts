import { expectType, expectError, expectAssignable } from 'tsd';
import type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  FilterParams,
  ValidationError,
  ErrorResponse,
  SuccessResponse,
} from '../../types/api';

// Test ApiResponse generic type
const successResponse: ApiResponse<{ id: string; name: string }> = {
  data: { id: '123', name: 'Test' },
  message: 'Success',
};
expectType<{ id: string; name: string } | undefined>(successResponse.data);

const errorResponse: ApiResponse<never> = {
  error: { code: 'NOT_FOUND', message: 'Not found' },
};
expectType<ApiError | undefined>(errorResponse.error);

// Test that ApiResponse with wrong type fails
expectError<ApiResponse<string>>({
  data: 123, // Should be string
});

// Test PaginatedResponse
const paginatedUsers: PaginatedResponse<{ id: string }> = {
  data: [{ id: '1' }, { id: '2' }],
  pagination: {
    page: 1,
    limit: 10,
    total: 50,
    totalPages: 5,
    hasNext: true,
    hasPrevious: false,
  },
};
expectType<{ id: string }[]>(paginatedUsers.data);
expectType<number>(paginatedUsers.pagination.total);

// Test PaginationParams
const params: PaginationParams = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
expectType<number>(params.page);
expectType<'asc' | 'desc' | undefined>(params.sortOrder);

// Test that invalid sortOrder fails
expectError<PaginationParams>({
  page: 1,
  limit: 10,
  sortOrder: 'invalid', // Should be 'asc' | 'desc'
});

// Test FilterParams allows dynamic keys
const filters: FilterParams = {
  search: 'test',
  dateFrom: '2024-01-01',
  status: 'active',
  customField: 'value',
};
expectAssignable<FilterParams>(filters);

// Test ValidationError
const validationErr: ValidationError = {
  field: 'email',
  message: 'Invalid email format',
  value: 'not-an-email',
};
expectType<string>(validationErr.field);
expectType<unknown | undefined>(validationErr.value);

// Test ErrorResponse
const errResp: ErrorResponse = {
  error: 'BadRequest',
  message: 'Validation failed',
  statusCode: 400,
  timestamp: '2024-12-31T00:00:00Z',
  validationErrors: [{ field: 'email', message: 'Required' }],
};
expectType<number>(errResp.statusCode);
expectType<ValidationError[] | undefined>(errResp.validationErrors);

// Test SuccessResponse
const successResp: SuccessResponse = {
  success: true,
  message: 'Operation completed',
  data: { result: 'ok' },
};
expectType<true>(successResp.success);
