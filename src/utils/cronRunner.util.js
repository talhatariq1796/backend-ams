// utils/cronRunner.js
import { sendSystemEmail } from "./email.js";

const MAX_ATTEMPTS = 3;

export const runCronWithRetry = async (jobName, jobFn, attempt = 1) => {
  console.log(`🕓 Attempt ${attempt}: Running ${jobName}...`);

  try {
    await jobFn();
    console.log(`✅ ${jobName} completed.`);
  } catch (error) {
    console.error(`❌ ${jobName} attempt ${attempt} failed: ${error.message}`);

    if (attempt < MAX_ATTEMPTS) {
      const delay = attempt * 30 * 1000;
      console.log(`🔁 Retrying in ${delay / 1000} seconds...`);
      setTimeout(() => runCronWithRetry(jobName, jobFn, attempt + 1), delay);
    } else {
      console.error(`⛔ Max retry attempts reached for ${jobName}.`);

      const errorDetails = `
        <p><strong>Error Message:</strong> ${error.message}</p>
        <p><strong>Stack Trace:</strong></p>
        <pre>${error.stack}</pre>
      `;

      await sendSystemEmail(
        `🚨 ${jobName} Failure Alert`,
        `<p>The ${jobName} failed after ${MAX_ATTEMPTS} attempts on 
        <strong>${new Date()}</strong>.</p>
        ${errorDetails}
        <p>Please check the server logs.</p>`,
        "awais.tariq@whiteboxtech.net" // Explicitly send failure emails to awais
      );
    }
  }
};
