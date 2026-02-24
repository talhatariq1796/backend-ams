import nodemailer from "nodemailer";

export const sendSystemEmail = async (subject, html, recipients = null) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.OUTLOOK_EMAIL,
      pass: process.env.OUTLOOK_PASSWORD,
    },
    tls: { ciphers: "SSLv3" },
  });

  // Default to awais if no recipients specified (for backward compatibility)
  const to = recipients 
    ? Array.isArray(recipients) 
      ? recipients.join(", ") 
      : recipients
    : "awais.tariq@whiteboxtech.net";

  const mailOptions = {
    from: process.env.OUTLOOK_EMAIL,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to: ${to}`);
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
  }
};
