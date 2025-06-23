/**
 * Streamlined API Response Utilities
 */

/**
 * Success response
 */
const successResponse = (message, data = null, meta = {}) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return response;
};

/**
 * Error response
 */
const errorResponse = (message, details = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (details) {
    response.details = details;
  }

  return response;
};

/**
 * Paginated response
 */
const paginatedResponse = (data, pagination, message = 'Data retrieved successfully') => {
  return successResponse(message, data, { pagination });
};

/**
 * Not found response
 */
const notFoundResponse = (resource) => {
  return errorResponse(`${resource} not found`);
};

/**
 * Validation error response
 */
const validationErrorResponse = (errors, message = 'Validation failed') => {
  return {
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  notFoundResponse,
  validationErrorResponse
};