export const passwordResetTemplate = (name, resetLink) => `
  <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f9f9f9; padding: 40px; color: #333;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

      <!-- Company Logo -->
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://www.whiteboxtech.net/assets/Images/homePage/logo.svg" alt="Whitebox Logo" style="max-height: 60px;">
      </div>

      <h2 style="color: #2c3e50;">Password Reset Request</h2>

      <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>

      <p style="font-size: 15px;">
        We received a request to reset the password for your Whitebox account. If you initiated this request, please click the button below to proceed.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" 
           style="background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 15px; border-radius: 6px; display: inline-block;">
          Reset Your Password
        </a>
      </div>

      <p style="font-size: 14px;">
        If you did not request a password reset, you can safely ignore this email. Your account remains secure.
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e1e1e1;">

      <p style="font-size: 14px; color: #555;">
        Best regards,<br>
        <strong>The Whitebox Team</strong>
      </p>

    </div>
  </div>
`;
