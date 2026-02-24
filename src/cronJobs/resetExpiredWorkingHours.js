import cron from "node-cron";
import WorkingHours from "../models/workingHours.model.js";
import OfficeConfig from "../models/config.model.js";
import User from "../models/user.model.js";
import { runCronWithRetry } from "../utils/cronRunner.util.js";

const resetExpiredWorkingHours = cron.schedule("55 23 * * *", () =>
  runCronWithRetry("Reset Expired Working Hours", async () => {
    const now = new Date();

    const expiringWorkingHours = await WorkingHours.find({
      expiry_date: {
        $lte: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999
        ),
      },
    });

    if (!expiringWorkingHours.length) {
      console.log("No users with expiring working hours today.");
      return;
    }

    const officeConfig = await OfficeConfig.findOne();
    if (!officeConfig?.working_hours || !officeConfig?.bd_working_hours) {
      throw new Error("Missing working_hours or bd_working_hours in config.");
    }

    for (const userWH of expiringWorkingHours) {
      const user = await User.findById(userWH.user_id);
      if (!user) {
        console.warn(`User not found: ${userWH.user_id}`);
        continue;
      }

      const isBusinessRole = user.role?.toLowerCase().includes("business");

      const workingHours = isBusinessRole
        ? officeConfig.bd_working_hours
        : officeConfig.working_hours;

      await WorkingHours.updateOne(
        { user_id: user._id },
        {
          $set: {
            is_week_custom_working_hours: false,
            checkin_time: workingHours.checkin_time,
            checkout_time: workingHours.checkout_time,
            custom_working_hours: [],
            expiry_date: null,
          },
        }
      );

      await User.updateOne(
        { _id: user._id },
        { $set: { is_default_working_hours: true } }
      );

      console.log(
        `✅ Reset working hours to ${
          isBusinessRole ? "BD" : "default"
        } for user ${user._id}`
      );
    }
  })
);

export default resetExpiredWorkingHours;
