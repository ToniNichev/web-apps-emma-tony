import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/app/lib/db';
import { SendEmail } from '@/app/lib/EmailUtils';
import { rateLimit, getClientIp } from '@/app/lib/rate-limit';

export async function POST(request: Request) {
  if (!rateLimit(getClientIp(request), 10, 15 * 60 * 1000)) {
    return NextResponse.json({ message: 'Too many attempts. Please wait a while.' }, { status: 429 });
  }

  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ message: 'Please provide a valid email address' }, { status: 400 });
  }

  const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]) as any[];

  if (rows.length > 0) {
    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');
    const resetUrl = `${protocol}://${host}/forgot-password/reset?token=${resetToken}`;

    const subject = '🔐 Reset Your Emma\'s Space Password';
    const bodyText = `You requested to reset your password. Click this link to set a new password: ${resetUrl}. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;

    const bodyHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #faf5ff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf5ff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">Emma's Space ✨</h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 8px 0 0;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 16px; text-align: center;">Reset Your Password</h2>
              <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0; text-align: center;">
                We received a request to reset your password. Click the button below to create a new one.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 30px; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; font-size: 18px; font-weight: 600; border-radius: 50px; box-shadow: 0 4px 14px rgba(236, 72, 153, 0.4);">
                Reset Password
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <p style="color: #a1a1aa; font-size: 13px; line-height: 1.5; margin: 0;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    try {
      await SendEmail(email, subject, bodyText, bodyHTML);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }
  }

  return NextResponse.json({
    message: 'If an account exists with this email, you will receive a password reset link shortly.',
  }, { status: 200 });
}
