import express from "express";
import * as CompanyController from "../controllers/company.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const CompanyRouter = express.Router();

// ============= PUBLIC ROUTES =============

// Get company enum values for registration form
CompanyRouter.get("/company/enums", CompanyController.GetCompanyEnums);

// Company registration (public - no authentication required)
CompanyRouter.post("/company/register", CompanyController.RegisterCompany);

// ============= REGISTRATION REQUEST MANAGEMENT =============

// Get pending registration requests
CompanyRouter.get(
  "/superadmin/registrations/pending",
  authenticateToken,
  CompanyController.GetPendingRegistrations,
);

// Approve company registration request
CompanyRouter.put(
  "/superadmin/registrations/:id/approve",
  authenticateToken,
  CompanyController.ApproveCompanyRegistration,
);

// Reject company registration request
CompanyRouter.put(
  "/superadmin/registrations/:id/reject",
  authenticateToken,
  CompanyController.RejectCompanyRegistration,
);

// ============= SUPER ADMIN ROUTES =============

// Get all companies
CompanyRouter.get(
  "/superadmin/companies",
  authenticateToken,
  CompanyController.GetAllCompanies,
);

// Get company by ID
CompanyRouter.get(
  "/superadmin/companies/:id",
  authenticateToken,
  CompanyController.GetCompanyById,
);

// Approve company
CompanyRouter.put(
  "/superadmin/companies/:id/approve",
  authenticateToken,
  CompanyController.ApproveCompany,
);

// Suspend company
CompanyRouter.put(
  "/superadmin/companies/:id/suspend",
  authenticateToken,
  CompanyController.SuspendCompany,
);

// Activate company
CompanyRouter.put(
  "/superadmin/companies/:id/activate",
  authenticateToken,
  CompanyController.ActivateCompany,
);

// Update company subscription
CompanyRouter.put(
  "/superadmin/companies/:id/subscription",
  authenticateToken,
  CompanyController.UpdateCompanySubscription,
);

// Get company statistics
CompanyRouter.get(
  "/superadmin/companies/:id/stats",
  authenticateToken,
  CompanyController.GetCompanyStats,
);

export default CompanyRouter;
