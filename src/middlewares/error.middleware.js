export default class AppError extends Error {
  constructor(message, statusCode, success = false) {
    super(message);
    this.statusCode = statusCode;
    this.success = success;

    Error.captureStackTrace(this, this.constructor);
  }
}

// export const AppResponse = ({ res, statusCode, message, data, success }) => {
//   return res.status(statusCode).json({
//     success,
//     message,
//     data,
//   });
// };

export const AppResponse = ({
  res,
  statusCode = 500,
  message = "Something went wrong",
  data = null,
  success = false,
}) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
  });
};
