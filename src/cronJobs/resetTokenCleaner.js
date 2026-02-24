import cron from "node-cron";
import Users from "../models/user.model.js";

const cleanExpiredResetTokens = cron.schedule("55 23 * * *", async () => {
  console.log("Running cron job to clean expired reset tokens...");
  try {
    const result = await Users.updateMany(
      {
        $or: [
          { reset_password_expires: { $lt: new Date() } },
          { reset_password_token: { $ne: null } },
        ],
      },
      {
        $set: {
          reset_password_token: null,
          reset_password_token_id: null,
          reset_password_expires: null,
        },
      }
    );
  } catch (error) {
    console.error("Cron job failed to clean expired reset tokens:", error);
  }
});

export default cleanExpiredResetTokens;
