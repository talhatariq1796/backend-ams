// REDIS DISABLED - Queue functionality disabled
// import Queue from "bull";
import Ticket from "../models/ticket.model.js";
import Users from "../models/user.model.js";
import { getCompanyId } from "../utils/company.util.js";

// const ticketQueue = new Queue("ticketQueue", {
//   redis: { host: "127.0.0.1", port: 6379 },
// });

// ticketQueue.process(async (job) => {
//   const { req, ...ticketData } = job.data;
  
//   // Extract company_id if available
//   let companyId = null;
//   if (req) {
//     companyId = getCompanyId(req);
//   } else if (ticketData.company_id) {
//     companyId = ticketData.company_id;
//   }

//   if (companyId) {
//     await Ticket.create({ ...ticketData, company_id: companyId });
//   } else {
//     await Ticket.create(ticketData);
//   }
// });

// Mock queue object - processes jobs immediately instead of queuing
const ticketQueue = {
  add: async (data) => {
    console.log("⚠️ Redis is disabled - Processing ticket immediately");
    const { req, ...ticketData } = data;
    
    // Extract company_id: from req, payload, or creator's company
    let companyId = null;
    if (req) {
      companyId = getCompanyId(req);
    }
    if (!companyId && ticketData.company_id) {
      companyId = ticketData.company_id;
    }
    if (!companyId && ticketData.created_by) {
      const creator = await Users.findById(ticketData.created_by).select("company_id").lean();
      if (creator?.company_id) companyId = creator.company_id;
    }

    await Ticket.create({ ...ticketData, ...(companyId && { company_id: companyId }) });
    return { id: "mock-job-id" };
  },
};

export default ticketQueue;
