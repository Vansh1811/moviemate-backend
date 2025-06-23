/**
 * Streamlined Error Handler Middleware
 */

const errorHandler = (err, req, res, next) => {
  console.error('🚨 Error:', err.message);
  
  let error = {
    success: false,
    message: err.message || 'Internal Server Error'
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate resource'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(error);
};

/**
 * Async error handler wrapper
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error
 */
const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  errorHandler,
  asyncErrorHandler,
  createError
};