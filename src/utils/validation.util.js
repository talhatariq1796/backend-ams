export const CheckValidation = (fields, req) => {
  for (let field of fields) {
    if (!req.body[field]) {
      return `${field} is required.`;
    }
  }
  return null;
};
