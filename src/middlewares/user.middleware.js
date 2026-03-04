import jwt from "jsonwebtoken";
import Users from "../models/user.model.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Please provide token." });
    }

    jwt.verify(token, process.env.ACCESS_SECRET_KEY, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Invalid or Expired Token" });
      }

      // Attach user from decoded token
      req.user = decoded.user;

      // If not super admin, fetch fresh user data with company context
      if (!decoded.user.is_super_admin) {
        try {
          const freshUser = await Users.findById(decoded.user._id).select(
            "company_id is_super_admin"
          );

          if (!freshUser) {
            return res.status(401).json({ message: "User not found." });
          }

          // Check if user has company_id
          if (!freshUser.company_id) {
            console.error(
              `⚠️  User ${decoded.user._id} (${decoded.user.email}) does not have company_id assigned.`
            );
            return res.status(403).json({
              message:
                "Your account is not associated with a company. Please contact admin for assistance.",
            });
          }

          // Attach company_id to request for tenant isolation
          req.user.company_id = freshUser.company_id;
          req.company_id = freshUser.company_id;
        } catch (dbError) {
          console.error("Error fetching user from DB:", dbError);
          return res
            .status(500)
            .json({ message: "Database error during authentication." });
        }
      } else {
        // Super admin - use company_id from token if available
        if (decoded.user.company_id) {
          req.company_id = decoded.user.company_id;
        }
      }

      next();
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Authentication failed." });
  }
};

// Middleware to enforce company context for non-super-admins
export const enforceCompanyContext = (req, res, next) => {
  // Super admins don't need company context
  if (req.user?.is_super_admin || req.user?.role === "super_admin") {
    return next();
  }

  // All other users must have company_id
  if (!req.user?.company_id && !req.company_id) {
    return res.status(403).json({
      message: "Company context required. Please login again.",
    });
  }

  req.company_id = req.company_id || req.user?.company_id;
  next();
};
