// queues/leaveSync.queue.js
import Queue from "bull";
import LeaveStats from "../models/leaveStats.model.js";
import Users from "../models/user.model.js";
import OfficeConfig from "../models/config.model.js";

export const leaveSyncQueue = new Queue("leave-sync");

// 👇 Process the queue
leaveSyncQueue.process(async (job) => {
  const { year, updatedTypes } = job.data;

  const config = await OfficeConfig.findOne();
  if (!config) return;

  const allUsers = await Users.find({
    is_active: true,
    designation: { $exists: true },
  }).select("_id designation");

  const isBusiness = (d) => d.toLowerCase().includes("business");

  for (const user of allUsers) {
    const type = isBusiness(user.designation) ? "business" : "general";
    if (!updatedTypes.includes(type)) continue;

    const stats = await LeaveStats.findOne({ user: user._id, year });
    if (!stats) continue;

    const typeConfig =
      type === "business"
        ? config.business_leave_types
        : config.general_leave_types;

    for (const leaveType in typeConfig) {
      if (!stats.leave_breakdown[leaveType]) continue;

      stats.leave_breakdown[leaveType].allowed = typeConfig[leaveType];
      const taken = stats.leave_breakdown[leaveType].taken || 0;
      stats.leave_breakdown[leaveType].remaining =
        typeConfig[leaveType] - taken;
    }

    stats.last_updated = new Date();
    await stats.save();
  }
});
