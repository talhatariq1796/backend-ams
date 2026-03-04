import { AppResponse } from "./error.middleware.js";

/**
 * Global error handling middleware
 * Catches all errors and sends a proper response
 */
export const globalErrorHandler = (err, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Log error for debugging
  console.error("❌ Global Error Handler:", {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    url: req.url,
    method: req.method,
  });

  // Handle AppError instances
  if (err.statusCode) {
    return AppResponse({
      res,
      statusCode: err.statusCode,
      message: err.message,
      success: false,
    });
  }

  // Handle validation errors (Mongoose)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return AppResponse({
      res,
      statusCode: 400,
      message: `Validation Error: ${messages.join(", ")}`,
      success: false,
    });
  }

  // Handle cast errors (Mongoose)
  if (err.name === "CastError") {
    return AppResponse({
      res,
      statusCode: 400,
      message: `Invalid ID format: ${err.message}`,
      success: false,
    });
  }

  // Handle duplicate key errors (MongoDB)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return AppResponse({
      res,
      statusCode: 400,
      message: `${field} already exists`,
      success: false,
    });
  }

  // Default server error
  return AppResponse({
    res,
    statusCode: 500,
    message: err.message || "Internal server error",
    success: false,
  });
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req, res) => {
  return AppResponse({
    res,
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    success: false,
  });
};

