/**
 * Extract enum values from a Mongoose model schema
 * @param {Object} schema - Mongoose schema object
 * @param {string} fieldName - Field name to extract enums from
 * @returns {Array} - Array of enum values
 */
export const getEnumFromSchema = (schema, fieldName) => {
  const field = schema.paths[fieldName];
  if (field && field.enumValues) {
    return field.enumValues;
  }
  return [];
};

/**
 * Get all relevant enum values for company registration
 * @param {Object} CompanyModel - Company Mongoose model
 * @param {Object} CompanyRegistrationModel - CompanyRegistration Mongoose model
 * @returns {Object} - Object containing all enum values
 */
export const getCompanyEnums = (CompanyModel, CompanyRegistrationModel) => {
  return {
    industry: getEnumFromSchema(CompanyRegistrationModel.schema, "industry"),
    subscription_tier: getEnumFromSchema(
      CompanyRegistrationModel.schema,
      "subscription_tier",
    ),
    subscription_billing: getEnumFromSchema(
      CompanyRegistrationModel.schema,
      "subscription_billing",
    ),
    company_status: getEnumFromSchema(CompanyModel.schema, "status"),
    plans: {
      starter: { tiers: ["monthly", "yearly"] },
      pro: { tiers: ["monthly", "yearly"] },
      enterprise: { tiers: ["monthly", "yearly"] },
    },
  };
};
