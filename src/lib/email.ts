import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "G3 Tornado <onboarding@resend.dev>";

export async function sendInviteEmail({
  to,
  signupUrl,
  invitedByEmail,
  role,
}: {
  to: string;
  signupUrl: string;
  invitedByEmail?: string;
  role?: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "You're invited to G3 Tornado",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0f172a; font-size: 24px; margin: 0;">🌪️ G3 Tornado</h1>
          <p style="color: #64748b; margin-top: 8px;">Task Management for Teams</p>
        </div>
        
        <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 24px;">
          <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">You've been invited!</h2>
          ${invitedByEmail ? `<p style="color: #475569;"><strong>${invitedByEmail}</strong> invited you to join G3 Tornado${role ? ` as <strong>${role}</strong>` : ""}.</p>` : ""}
          <p style="color: #475569;">Click the button below to create your account and get started.</p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${signupUrl}" style="display: inline-block; background: #14b8a6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #94a3b8; font-size: 13px; margin-bottom: 0;">
            Or copy this link: <a href="${signupUrl}" style="color: #14b8a6; word-break: break-all;">${signupUrl}</a>
          </p>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          This invitation expires in 7 days. If you didn't expect this email, you can ignore it.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send invite email:", error);
    return { success: false, error: error.message };
  }

  return { success: true, emailId: data?.id };
}
