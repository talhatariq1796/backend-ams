import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Users from "../models/user.model.js";
import { CheckValidation } from "../utils/validation.util.js";
import { passwordResetTemplate } from "../utils/emailTemplates.js";
import Teams from "../models/team.model.js";
import Attendances from "../models/attendance.model.js";
import mongoose from "mongoose";
import AppError from "../middlewares/error.middleware.js";
import { invalidateCache } from "../utils/cache.util.js";
import { InitializeLeaveStatsForUser } from "../utils/leaveStats.util.js";
import { transporter } from "../utils/mailer.util.js";

export const RegisterUserService = async (userData) => {
  const {
    first_name,
    last_name,
    email,
    profile_picture,
    password = "@Abc1234",
    gender,
    contact_number,
    cnic,
    city,
    state,
    address,
    designation,
    team,
    role,
    employment_status,
    joining_date,
    date_of_birth,
    reference_contact_number = "",
  } = userData;

  // if (!email.endsWith("@whiteboxtech.net")) {
  //   throw new AppError(
  //     "Registration is only allowed for WhiteBox company.",
  //     400
  //   );
  // }
  const validationError = CheckValidation(
    [
      "first_name",
      "last_name",
      "email",
      "gender",
      "contact_number",
      "cnic",
      "city",
      "state",
      "address",
      "designation",
      "role",
      "employment_status",
      "joining_date",
    ],
    { body: userData },
  );
  if (validationError) {
    throw new AppError(validationError, 400);
  }
  if (address.length < 5) {
    throw new AppError("Address must be at least 5 characters long.", 400);
  }
  const existingUser = await Users.findOne({
    email: { $regex: new RegExp("^" + email + "$", "i") },
  });
  const totalUsers = await Users.countDocuments();
  if (existingUser) {
    throw new AppError("User already exists", 400);
  }

  const lastUser = await Users.findOne({})
    .sort({ employee_id: -1 })
    .collation({ locale: "en_US", numericOrdering: true });

  let nextEmployeeId = 1;
  if (lastUser) {
    const lastIdNum = parseInt(lastUser.employee_id.split("-")[1]);
    nextEmployeeId = lastIdNum + 1;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new Users({
    first_name,
    last_name,
    email: email.toLowerCase(),
    profile_picture,
    password: hashedPassword,
    employee_id: `WB-${nextEmployeeId}`,
    gender,
    contact_number,
    cnic,
    city,
    state,
    address,
    designation,
    team,
    role,
    employment_status,
    joining_date,
    date_of_birth,
    is_active: true,
    reference_contact_number,
  });
  try {
    await newUser.save();
    if (team) {
      await Teams.findByIdAndUpdate(team, {
        $addToSet: { members: newUser._id },
      });
    }
    const userResponse = newUser.toObject();
    delete userResponse.password;
    await InitializeLeaveStatsForUser(newUser._id, new Date().getFullYear()); //updated leave stats

    return userResponse;
  } catch (error) {
    console.error("Error saving user:", error);
    throw new AppError("Internal server error", 500);
  }
};

export const LoginUserService = async ({ email, password, fcmToken }) => {
  try {
    const user = await Users.findOne({
      email: { $regex: new RegExp("^" + email + "$", "i") },
    }).populate({
      path: "team",
      select: "_id name department",
      populate: {
        path: "department",
        select: "_id name",
      },
    });

    if (
      !user ||
      !["admin", "employee", "teamLead", "manager"].includes(user.role)
    ) {
      throw new AppError("Invalid credentials.", 400);
    }

    if (!user.is_active) {
      throw new AppError(
        "Your account is inactive. Please contact admin.",
        403,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials", 401);
    }

    if (fcmToken && user.fcmToken !== fcmToken) {
      user.fcmToken = fcmToken;
      await user.save();
      console.log("✅ FCM Token updated for user:", user.name);
    }

    const userInfo = {
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      gender: user.gender,
      contact_number: user.contact_number,
      reference_contact_number: user.reference_contact_number,
      date_of_birth: user.date_of_birth,
      city: user.city,
      state: user.state,
      address: user.address,
      cnic: user.cnic,
      designation: user.designation,
      team: user.team,
      role: user.role,
      employment_status: user.employment_status,
      joining_date: user.joining_date,
      profile_picture: user.profile_picture,
      custom_working_hours: user.custom_working_hours,
      is_active: user.is_active,
      employee_id: user.employee_id,
    };

    const access_tokenDuration = 24 * 60 * 60 * 60 * 3;
    const refresh_tokenDuration = 30 * 24 * 60 * 60;

    const accessToken = jwt.sign(
      { user: userInfo },
      process.env.ACCESS_SECRET_KEY,
      { expiresIn: access_tokenDuration },
    );

    const refreshToken = jwt.sign(
      { user: userInfo },
      process.env.REFRESH_SECRET_KEY,
      { expiresIn: refresh_tokenDuration },
    );

    const access_tokenExpiration = new Date(
      Date.now() + access_tokenDuration * 1000,
    );
    const refresh_tokenExpiration = new Date(
      Date.now() + refresh_tokenDuration * 1000,
    );

    return {
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        access_expiresAt: access_tokenExpiration,
        refresh_expiresAt: refresh_tokenExpiration,
      },
      loggedInUser: userInfo,
    };
  } catch (error) {
    console.error("Login error:", error.message);
    throw new AppError(
      error.message || "Internal server error",
      error.statusCode || 500,
    );
  }
};

export const ForgotPasswordService = async ({ email }) => {
  if (!email) throw new AppError("Please provide email", 400, false);

  const user = await Users.findOne({ email });
  if (!user) throw new AppError("User not found", 404, false);

  const tokenId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign({ email, tokenId }, process.env.JWT_SECRET_KEY, {
    expiresIn: "1h",
  });
  const decoded = jwt.decode(token);
  const expiry = decoded.exp * 1000;

  user.reset_password_token = token;
  user.reset_password_token_id = tokenId;
  user.reset_password_expires = expiry;
  await user.save({ validateBeforeSave: false });

  const resetLink = `${process.env.LIVE_FRONTEND_URL}/#/auth/reset-password/${token}`;
  console.log("Reset link:", resetLink);

  const mailOptions = {
    from: `"Whitebox AMS" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: "Reset Your Password - Action Required",
    html: passwordResetTemplate(user.first_name, resetLink),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending error:", error);
    throw new AppError("Failed to send password reset email", 500);
  }
};

export const ChangePasswordService = async ({
  email,
  currentPassword,
  newPassword,
}) => {
  if (!email || !currentPassword || !newPassword) {
    throw new AppError("Please provide all required fields", 400);
  }
  if (currentPassword === newPassword) {
    throw new AppError("New password can not be same as current password", 400);
  }
  const user = await Users.findOne({ email });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError("Current password is incorrect", 401);
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  try {
    // Use updateOne to only update the password field without triggering full document validation
    await Users.updateOne({ email }, { $set: { password: hashedPassword } });
    return true;
  } catch (error) {
    console.error("Failed to update user password:", error);
    console.error("Error details:", error.message, error.stack);
    throw new AppError(error.message || "Internal server error", 500);
  }
};

export const ResetPasswordService = async (token, newPassword) => {
  if (!token || !newPassword) {
    throw new AppError("Missing token or new password", 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    throw new AppError("Invalid or expired token", 401);
  }

  const user = await Users.findOne({ email: decoded.email });
  if (!user) throw new AppError("User not found", 404);

  if (
    !user.reset_password_token ||
    !user.reset_password_token_id ||
    user.reset_password_token !== token ||
    user.reset_password_token_id !== decoded.tokenId ||
    user.reset_password_expires < Date.now()
  ) {
    throw new AppError("Reset link is invalid or has expired", 401);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    // Use updateOne to only update the password and reset token fields without triggering full document validation
    await Users.updateOne(
      { email: decoded.email },
      {
        $set: {
          password: hashedPassword,
          reset_password_token: null,
          reset_password_token_id: null,
          reset_password_expires: null,
        },
      },
    );
    return true;
  } catch (error) {
    console.error("Failed to reset password:", error);
    console.error("Error details:", error.message, error.stack);
    throw new AppError(error.message || "Failed to reset password", 500);
  }
};

export const FetchEmployeeService = async (employeeId) => {
  const employee = await Users.findOne({
    _id: employeeId,
    role: { $ne: "admin" },
  })
    .select(
      "_id first_name last_name email gender contact_number reference_contact_number date_of_birth cnic city state address designation role employment_status joining_date is_default_working_hours profile_picture is_active",
    )
    .populate({
      path: "team",
      select: "_id name department",
      populate: {
        path: "department",
        select: "_id name",
      },
    });
  if (!employee) {
    throw new AppError("Employee not found", 200, true);
  }
  return employee;
};

export const FetchEmployeesService = async ({
  page = 1,
  limit = 10,
  search = "",
  employment_status,
  department,
  team,
  _id,
  user,
  ...rest
}) => {
  const query = {
    role: { $in: ["employee", "teamLead"] },
    is_active: true,
  };

  const invalidFilters = Object.keys(rest).filter(
    (key) =>
      ![
        "page",
        "limit",
        "search",
        "employment_status",
        "department",
        "team",
        "_id",
      ].includes(key),
  );
  if (invalidFilters.length > 0) {
    throw new AppError("No records found. Invalid filter provided.", 200, true);
  }

  if (search.trim()) {
    // Escape special regex characters and search in concatenated full name
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [
      { first_name: searchRegex },
      { last_name: searchRegex },
      { employee_id: searchRegex },
      // Search in concatenated full name for queries like "zeeshan ali"
      {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: ["$first_name", ""] },
                " ",
                { $ifNull: ["$last_name", ""] },
              ],
            },
            regex: escapedSearch,
            options: "i",
          },
        },
      },
    ];
  }

  if (employment_status) {
    query.employment_status = employment_status;
  }

  if (department) {
    const teamsInDepartment = await Teams.find({ department }, "_id");
    const teamIds = teamsInDepartment.map((t) => t._id);
    query.team = { $in: teamIds };
  }

  if (team) {
    query.team = team;
  }

  if (_id) {
    if (mongoose.Types.ObjectId.isValid(_id)) {
      query._id = mongoose.Types.ObjectId(_id);
    } else {
      throw new AppError("Invalid employee ID format.", 200, true);
    }
  }

  const employees = await Users.find(query)
    .select(
      "role employee_id email joining_date employment_status designation first_name last_name profile_picture team is_active",
    )
    .skip((page - 1) * parseInt(limit))
    .limit(parseInt(limit))
    .sort({ role: -1, created_at: -1, _id: 1 })
    .lean();

  const employeeIds = employees.map((e) => e._id);

  const today = new Date();
  const queryDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const attendanceRecords = await Attendances.find({
    user_id: { $in: employeeIds },
    date: queryDate,
  });

  const attendanceMap = new Map();
  attendanceRecords.forEach((record) => {
    attendanceMap.set(record.user_id.toString(), record.status);
  });

  const teamIds = employees.map((emp) => emp.team).filter(Boolean);
  const teamsWithDepartments = await Teams.find({ _id: { $in: teamIds } })
    .select("department")
    .populate("department", "name _id");

  const teamDepartmentMap = teamsWithDepartments.reduce((acc, team) => {
    acc[team._id] = team.department ? team.department.name : "Not Assigned";
    return acc;
  }, {});

  const formattedEmployees = employees.map((emp) => ({
    _id: emp._id,
    employee_id: emp.employee_id,
    email: emp.email,
    joining_date: emp.joining_date,
    employment_status: emp.employment_status,
    designation: emp.designation,
    first_name: emp.first_name,
    last_name: emp.last_name,
    profile_picture: emp.profile_picture,
    role: emp.role,
    team: emp.team,
    is_active: emp.is_active,
    attendance_status: attendanceMap.get(emp._id.toString()) || "Awaiting",
    department_name: emp.team
      ? teamDepartmentMap[emp.team] || "Not Assigned"
      : "Not Assigned",
  }));

  const total = await Users.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const hasMorePages = totalPages - currentPage === 0 ? false : true;

  return {
    employees: formattedEmployees,
    total,
    currentPage,
    totalPages,
    hasMorePages,
  };
};

export const FetchAllUsersService = async () => {
  const users = await Users.find().select("-password");
  return users;
};

export const UpdateUserActivationStatusService = async (userId, is_active) => {
  try {
    const updatedUser = await Users.findByIdAndUpdate(
      userId,
      { is_active },
      { new: true },
    );
    return updatedUser;
  } catch (error) {
    throw new AppError("Internal server error", 500);
  }
};

export const FetchUserService = async (userId) => {
  const user = await Users.findById(userId)
    .select("-password")
    .populate({
      path: "team",
      select: "_id name department",
      populate: {
        path: "department",
        select: "_id name",
      },
    });

  if (!user) {
    throw new AppError("No users found", 200, true);
  }

  return user;
};

export const UpdateUserByAdminService = async (userId, updatedUserData) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await Users.findById(userId).session(session);
    if (!user) {
      throw new Error("User not found");
    }
    const newTeamId = updatedUserData.team;
    const oldTeamId = user.team;
    if (updatedUserData.team) {
      if (oldTeamId && oldTeamId !== newTeamId) {
        await Teams.findByIdAndUpdate(
          oldTeamId,
          { $pull: { members: userId } },
          { session },
        );
      }
      if (newTeamId && newTeamId !== oldTeamId) {
        await Teams.findByIdAndUpdate(
          newTeamId,
          { $addToSet: { members: userId } },
          { session },
        );
      }
    }
    const updatedUser = await Users.findByIdAndUpdate(userId, updatedUserData, {
      new: true,
    })
      .select(
        "_id first_name last_name email gender contact_number reference_contact_number date_of_birth cnic city state address designation role employment_status joining_date is_default_working_hours profile_picture",
      )
      .populate({
        path: "team",
        select: "_id name department",
        populate: {
          path: "department",
          select: "_id name",
        },
      });
    await session.commitTransaction();
    session.endSession();
    return updatedUser;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(error.message || "Failed to update user");
  }
};

export const UpdateEmployeeService = async (userId, updatedUserData) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await Users.findById(userId).session(session);
    if (!user) {
      throw new AppError("User not found", 200, true);
    }
    const allowedFields = [
      "first_name",
      "last_name",
      "contact_number",
      "reference_contact_number",
      "date_of_birth",
      "address",
      "profile_picture",
    ];
    const updatedData = {};
    for (let field of allowedFields) {
      if (field in updatedUserData) {
        updatedData[field] = updatedUserData[field];
      }
    }
    if (Object.keys(updatedData).length === 0) {
      throw new AppError("No updatable fields provided", 200, true);
    }
    const updatedUser = await Users.findByIdAndUpdate(userId, updatedData, {
      new: true,
    })
      .select(
        "_id first_name last_name email gender contact_number reference_contact_number date_of_birth cnic city state address designation role employment_status joining_date is_default_working_hours profile_picture is_active employee_id",
      )
      .populate({
        path: "team",
        select: "_id name department",
        populate: {
          path: "department",
          select: "_id name",
        },
      });
    await session.commitTransaction();
    session.endSession();

    return updatedUser;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new AppError("Failed to update user", 400);
  }
};

export const FetchAllAdminsService = async ({
  page = 1,
  limit = 10,
  search = "",
  role = "admin",
}) => {
  const validRoles = Users.schema.path("role").enumValues;

  if (!validRoles.includes(role)) {
    const error = new Error(
      `Invalid role: '${role}'. Allowed roles are ${validRoles.join(", ")}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const query = {
    role: { $in: [role] },
  };

  if (search.trim()) {
    // Escape special regex characters and search in concatenated full name
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [
      { first_name: searchRegex },
      { last_name: searchRegex },
      { email: searchRegex },
      // Search in concatenated full name for queries like "admin W"
      {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: ["$first_name", ""] },
                " ",
                { $ifNull: ["$last_name", ""] },
              ],
            },
            regex: escapedSearch,
            options: "i",
          },
        },
      },
    ];
  }

  const usersRaw = await Users.find(query)
    .select("first_name last_name email profile_picture designation")
    .sort({ created_at: -1 })
    .skip((page - 1) * parseInt(limit))
    .limit(parseInt(limit));
  const users = usersRaw.map((user) => ({ user }));

  const total = await Users.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const hasMorePages = totalPages - currentPage > 0;
  return {
    users,
    total,
    currentPage,
    totalPages,
    hasMorePages,
    role,
  };
};

export const UpdateUserRoleService = async (
  userId,
  newRole,
  requestingUserId,
) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID format", 200, true);
  }

  const validRoles = ["admin", "employee", "teamLead"];
  if (!validRoles.includes(newRole)) {
    throw new AppError(
      `Invalid role. Allowed roles: ${validRoles.join(", ")}`,
      200,
      true,
    );
  }

  const user = await Users.findById(userId);
  if (!user) {
    throw new AppError("User not found", 200, true);
  }
  if (user._id.toString() === requestingUserId.toString()) {
    throw new AppError("You cannot modify your own role", 403);
  }

  user.role = newRole;
  await user.save({ validateModifiedOnly: true });

  return {
    _id: user._id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    designation: user.designation,
  };
};

export const RefreshTokenService = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
    if (!decoded.user) {
      throw new AppError("Invalid refresh token.", 200, true);
    }
    const accessToken = jwt.sign(
      { user: decoded.user },
      process.env.ACCESS_SECRET_KEY,
      { expiresIn: "24h" },
    );
    const newRefreshToken = jwt.sign(
      { user: decoded.user },
      process.env.REFRESH_SECRET_KEY,
      { expiresIn: "7d" },
    );
    const access_tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const refresh_tokenExpiration = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    return {
      tokens: {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        access_expiresAt: access_tokenExpiration,
        refresh_expiresAt: refresh_tokenExpiration,
      },
    };
  } catch (error) {
    console.error("Refresh token error:", error.message);
    throw new AppError(error.message || "Invalid refresh token.", 400);
  }
};

export const CountEmployeesService = async () => {
  const matchStage = {
    is_active: true,
    role: { $ne: "admin" },
  };

  const aggregation = await Users.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$employment_status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    permanent: 0,
    internship: 0,
    probation: 0,
  };

  aggregation.forEach(({ _id, count }) => {
    result.total += count;
    result[_id] = count;
  });

  return result;
};

export const UpdateFcmToken = async (req, res) => {
  const { fcmToken } = req.body;
  await Users.findByIdAndUpdate(req.params.id, { fcmToken });
  res.status(200).json({ message: "FCM Token updated" });
};

export const DeleteUserService = async (userId) => {
  const user = await Users.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Remove user from team if assigned
  if (user.team) {
    await Teams.findByIdAndUpdate(user.team, {
      $pull: { members: user._id },
    });
  }

  // Delete user
  await Users.findByIdAndDelete(userId);

  return {
    message: `User ${user.first_name} ${user.last_name} deleted successfully.`,
  };
};
