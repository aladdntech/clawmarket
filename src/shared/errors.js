class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

// Express error handler middleware
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  // Log server errors
  if (statusCode >= 500) {
    console.error(`❌ ${req.method} ${req.path}:`, err);
  }
  
  res.status(statusCode).json({
    error: err.message,
    code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = { AppError, NotFoundError, ValidationError, AuthError, ConflictError, errorHandler };
