// queues/leaveSync.queue.js
import Queue from "bull";
import LeaveStats from "../models/leaveStats.model.js";
import Users from "../models/user.model.js";
import CompanyConfigs from "../models/config.model.js";
import Company from "../models/company.model.js";

export const leaveSyncQueue = new Queue("leave-sync");

// 👇 Process the queue
leaveSyncQueue.process(async (job) => {
  const { year, updatedTypes, companyId } = job.data;

  // If companyId is provided, process for that company only
  if (companyId) {
    await processCompanySync(companyId, year, updatedTypes);
    return;
  }

  // Otherwise process for all active companies
  const companies = await Company.find({ is_active: true, status: "approved" });
  
  for (const company of companies) {
    await processCompanySync(company._id.toString(), year, updatedTypes);
  }
});

async function processCompanySync(companyId, year, updatedTypes) {
  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) {
    console.log(`⚠️  No config found for company ${companyId}`);
    return;
  }

  console.log(`🔄 Processing leave sync for company: ${companyId}`);

  const allUsers = await Users.find({
    company_id: companyId,
    is_active: true,
    designation: { $exists: true },
  }).select("_id designation");

  const isBusiness = (d) => d.toLowerCase().includes("business");

  for (const user of allUsers) {
    const type = isBusiness(user.designation) ? "business" : "general";
    if (!updatedTypes.includes(type)) continue;

    const stats = await LeaveStats.findOne({ 
      company_id: companyId,
      user: user._id, 
      year 
    });
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

  console.log(`✅ Completed leave sync for company: ${companyId}`);
}
