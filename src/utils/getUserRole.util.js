export const checkUserAuthorization = (user) => {
  if (!user) {
    const error = new Error("Unauthorized: No user found in request");
    error.statusCode = 401;
    throw error;
  }
};

export const isAdmin = (user) => {
  if (!user || user.role !== "admin") {
    const error = new Error("Unauthorized access");
    error.statusCode = 403;
    throw error;
  }
};

export const isAdminOrTeamLead = (user) => {
  if (
    !user ||
    (user.role !== "admin" &&
      user.role !== "teamLead" &&
      user.role !== "manager")
  ) {
    const error = new Error("Unauthorized access");
    error.statusCode = 403;
    throw error;
  }
};
