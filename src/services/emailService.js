/**
 * Email service
 * Sends emails from the backend using EmailJS REST API
 */

const EMAILJS_API = 'https://api.emailjs.com/api/v1.0/email/send';

const config = {
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
  serviceId: process.env.EMAILJS_SERVICE_ID || 'service_t1l15ge',
  templateWelcome: process.env.EMAILJS_TEMPLATE_WELCOME || 'template_hr8f21p',
  templatePasswordReset: process.env.EMAILJS_TEMPLATE_PASSWORD_RESET || 'template_2icng4s',
};

/**
 * Check if EmailJS is properly configured
 */
const isConfigured = () => {
  const hasKeys = config.publicKey && config.privateKey;
  if (!hasKeys) {
    console.log('[EmailService] Not configured: missing EMAILJS_PUBLIC_KEY or EMAILJS_PRIVATE_KEY');
    return false;
  }
  return true;
};

/**
 * Send welcome email via EmailJS REST API
 * @param {string} userEmail - Recipient email
 * @param {string} userName - Recipient name
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
const sendWelcomeEmail = async (userEmail, userName) => {
  console.log('[EmailService] Attempting to send welcome email to:', userEmail);

  if (!isConfigured()) {
    return { success: false, error: 'EmailJS not configured' };
  }

  const template_params = {
    email: userEmail,
    name: userName || 'Player',
    to_email: userEmail,
    user_email: userEmail,
    to_name: userName || 'Player',
    user_name: userName || 'Player',
    app_name: 'Square Puzzles',
  };

  const payload = {
    service_id: config.serviceId,
    template_id: config.templateWelcome,
    user_id: config.publicKey,
    accessToken: config.privateKey,
    template_params,
  };

  try {
    const response = await fetch(EMAILJS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[EmailService] Welcome email sent successfully to:', userEmail);
      return { success: true };
    }

    const errorText = await response.text();
    console.error('[EmailService] Failed to send welcome email:', response.status, errorText);
    return { success: false, error: errorText || `HTTP ${response.status}` };
  } catch (err) {
    console.error('[EmailService] Error sending welcome email:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send password reset email via EmailJS REST API
 * @param {string} userEmail - Recipient email
 * @param {string} resetToken - The raw reset token
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
const sendPasswordResetEmail = async (userEmail, resetToken) => {
  console.log('[EmailService] Attempting to send password reset email to:', userEmail);

  if (!isConfigured()) {
    return { success: false, error: 'EmailJS not configured' };
  }

  // Use CLIENT_URL from env, fallback to frontend URL for safety
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

  // Template variables for EmailJS Password Reset template (OTP)
  const template_params = {
    email: userEmail,
    to_email: userEmail,
    passcode: resetToken, // sending OTP as passcode variable
    time: '5 minutes',
    app_name: 'Square Puzzles',
  };

  const payload = {
    service_id: config.serviceId,
    template_id: config.templatePasswordReset,
    user_id: config.publicKey,
    accessToken: config.privateKey,
    template_params,
  };

  try {
    const response = await fetch(EMAILJS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[EmailService] Password reset email sent successfully to:', userEmail);
      return { success: true };
    }

    const errorText = await response.text();
    console.error('[EmailService] Failed to send password reset email:', response.status, errorText);
    return { success: false, error: errorText || `HTTP ${response.status}` };
  } catch (err) {
    console.error('[EmailService] Error sending password reset email:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  isConfigured,
};
