/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  
  // Don't leak internal errors to clients
  const statusCode = err.statusCode || 500;
  const response = {
    error: err.code || 'INTERNAL_ERROR',
    message: statusCode === 500 ? 'An internal server error occurred' : err.message,
  };
  
  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    response.details = err.message;
    response.stack = err.stack?.split('\n').slice(0, 5);
  }
  
  res.status(statusCode).json(response);
}

module.exports = errorHandler;
