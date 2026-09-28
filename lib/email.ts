import { Resend } from 'resend';

// Lazy statt Modul-Ebene: `new Resend(undefined)` wirft sofort ("Missing API
// key"). Auf Modul-Ebene instanziiert crasht das nicht nur den Mailversand,
// sondern (Next.js führt jede Route-Datei beim Build einmal aus) den
// gesamten Vercel-Build, sobald RESEND_API_KEY in einer Umgebung fehlt -
// exakt das Muster, das in app/api/feedback/route.ts am 23.09.2026 schon
// einmal gefixt wurde.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// feedbackConfirmation embeds free-text user input (the feedback message)
// into HTML - escape it so a message can't inject markup/links into the
// email a real recipient opens.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Email templates
const templates = {
  confirmEmail: (confirmLink: string, confirmCode?: string) => `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kidgo – Email bestätigen</title>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; }
            body { font-family: 'Nunito', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6; color: #333333; }
            .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .email-header { background: linear-gradient(135deg, #5BBAA7 0%, #4a9a90 100%); padding: 40px 30px; text-align: center; }
            .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
            .email-hero { background-color: #f9fafb; padding: 40px 30px; text-align: center; border-bottom: 3px solid #5BBAA7; }
            .hero-title { font-size: 28px; font-weight: 800; color: #2D3436; margin-bottom: 12px; }
            .hero-subtitle { font-size: 16px; color: #666666; }
            .email-content { padding: 40px 30px; }
            .content-block { margin-bottom: 24px; }
            .content-block p { font-size: 16px; line-height: 1.8; color: #333333; margin-bottom: 12px; }
            .confirmation-box { background-color: #f0f9f7; border: 2px solid #5BBAA7; padding: 30px; margin: 32px 0; border-radius: 6px; text-align: center; }
            .confirmation-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #2D3436; letter-spacing: 0.5px; margin-bottom: 16px; display: block; }
            .confirmation-code { font-size: 32px; font-weight: 800; color: #5BBAA7; letter-spacing: 4px; font-family: 'Courier New', monospace; margin: 0; }
            .code-note { font-size: 12px; color: #666666; margin-top: 12px; }
            .cta-section { text-align: center; margin: 32px 0; }
            .cta-button { display: inline-block; background-color: #5BBAA7; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 6px; border: 2px solid #5BBAA7; }
            .info-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 14px; }
            .info-box p { margin: 0; color: #856404; }
            .divider { height: 1px; background-color: #e5e7eb; margin: 32px 0; }
            .email-footer { background-color: #2D3436; color: #ffffff; padding: 30px; font-size: 13px; text-align: center; }
            .footer-links { margin-top: 16px; }
            .footer-links a { color: #5BBAA7; text-decoration: none; margin: 0 12px; display: inline-block; }
            .footer-text { color: #b0b0b0; margin: 12px 0 0 0; line-height: 1.6; font-size: 12px; }
            @media (max-width: 600px) {
                .email-content, .email-footer { padding: 30px 20px; }
                .cta-button { display: block; width: 100%; text-align: center; box-sizing: border-box; }
                .footer-links a { display: block; margin: 8px 0; }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <div class="logo">kidgo</div>
            </div>
            <div class="email-hero">
                <h1 class="hero-title">Bestätige deine E-Mail</h1>
                <p class="hero-subtitle">Dein Kidgo-Abenteuer beginnt in wenigen Sekunden!</p>
            </div>
            <div class="email-content">
                <div class="content-block">
                    <p>Willkommen bei Kidgo! 👋</p>
                    <p>Wir freuen uns riesig, dass du dabei bist. Um dein Konto zu aktivieren, bestätige bitte deine E-Mail-Adresse.</p>
                </div>
                ${confirmCode ? `
                <div class="confirmation-box">
                    <span class="confirmation-label">Bestätigungscode</span>
                    <p class="confirmation-code">${confirmCode}</p>
                    <p class="code-note">oder klick auf den Button unten</p>
                </div>
                ` : ''}
                <div class="cta-section">
                    <a href="${confirmLink}" class="cta-button">E-Mail bestätigen</a>
                </div>
                <div class="info-box">
                    <p><strong>Sicherheitshinweis:</strong> Dieser Link ist 24 Stunden lang gültig. Wenn du dieses Konto nicht erstellt hast, ignoriere diese E-Mail einfach.</p>
                </div>
                <div class="divider"></div>
                <div class="content-block">
                    <p><strong>Was kommt als Nächstes?</strong></p>
                    <p>Nach der Bestätigung kannst du:</p>
                    <ul style="margin: 12px 0 12px 20px; color: #333333;">
                        <li>Deine Interessensgebiete auswählen</li>
                        <li>Informationen zu deinen Kindern hinzufügen</li>
                        <li>Spontan Events in deiner Nähe entdecken</li>
                    </ul>
                </div>
                <div class="content-block">
                    <p>Haben Sie Fragen oder Probleme? Antworten Sie einfach auf diese E-Mail – wir sind hier, um zu helfen!</p>
                </div>
            </div>
            <div class="email-footer">
                <p style="margin: 0;">Kidgo – Der schnellste Weg für Zürcher Eltern, spontan Events zu finden</p>
                <div class="footer-links">
                    <a href="https://kidgo.ch/impressum">Impressum</a>
                    <a href="https://kidgo.ch/datenschutz">Datenschutz</a>
                </div>
                <p class="footer-text">
                    Diese E-Mail wurde dir zugesandt, weil du dich bei Kidgo registriert hast.<br>
                    © 2026 Kidgo. Alle Rechte vorbehalten.
                </p>
            </div>
        </div>
    </body>
    </html>
  `,
  feedbackConfirmation: (message: string, categoryLabel: string) => `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kidgo – Danke für dein Feedback</title>
        <style>
            * { margin: 0; padding: 0; }
            body { font-family: 'Nunito', Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6; color: #333333; }
            .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .email-header { background: linear-gradient(135deg, #5BBAA7 0%, #4a9a90 100%); padding: 32px 30px; text-align: center; }
            .logo { font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
            .email-content { padding: 36px 30px; }
            .hero-title { font-size: 22px; font-weight: 800; color: #2D3436; margin-bottom: 12px; }
            .content-block p { font-size: 15px; line-height: 1.8; color: #333333; margin-bottom: 12px; }
            .message-box { background-color: #f0f9f7; border-left: 4px solid #5BBAA7; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
            .message-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #5BBAA7; letter-spacing: 0.5px; display: block; margin-bottom: 8px; }
            .message-text { font-size: 15px; color: #2D3436; white-space: pre-wrap; }
            .email-footer { background-color: #2D3436; color: #ffffff; padding: 26px 30px; font-size: 13px; text-align: center; }
            .footer-links a { color: #5BBAA7; text-decoration: none; margin: 0 12px; display: inline-block; }
            .footer-text { color: #b0b0b0; margin: 12px 0 0 0; line-height: 1.6; font-size: 12px; }
            @media (max-width: 600px) {
                .email-content, .email-footer { padding: 28px 20px; }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <div class="logo">kidgo</div>
            </div>
            <div class="email-content">
                <h1 class="hero-title">Danke für dein Feedback! 🙌</h1>
                <div class="content-block">
                    <p>Wir haben deine Nachricht (${escapeHtml(categoryLabel)}) erhalten und schauen sie uns an.</p>
                </div>
                <div class="message-box">
                    <span class="message-label">Deine Nachricht</span>
                    <p class="message-text">${escapeHtml(message)}</p>
                </div>
                <div class="content-block">
                    <p>Eine persönliche Antwort gibt's nicht auf jede Meldung, aber jedes Feedback hilft uns, Kidgo besser zu machen.</p>
                </div>
            </div>
            <div class="email-footer">
                <p style="margin: 0;">Kidgo – Der schnellste Weg für Zürcher Eltern, spontan Events zu finden</p>
                <div class="footer-links">
                    <a href="https://kidgo.ch/impressum">Impressum</a>
                    <a href="https://kidgo.ch/datenschutz">Datenschutz</a>
                </div>
                <p class="footer-text">
                    Diese E-Mail wurde dir zugesandt, weil du über kidgo.ch Feedback mit einer E-Mail-Adresse eingereicht hast.<br>
                    © 2026 Kidgo. Alle Rechte vorbehalten.
                </p>
            </div>
        </div>
    </body>
    </html>
  `,
};

export async function sendFeedbackConfirmationEmail(
  email: string,
  message: string,
  categoryLabel: string
) {
  try {
    const result = await getResend().emails.send({
      from: 'Kidgo <contact@kidgo.ch>',
      to: email,
      subject: 'Danke für dein Feedback – Kidgo',
      html: templates.feedbackConfirmation(message, categoryLabel),
    });

    if (result.error) {
      console.error('Failed to send feedback confirmation email:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Error sending feedback confirmation email:', error);
    return { success: false, error };
  }
}

export async function sendConfirmationEmail(
  email: string,
  confirmLink: string,
  confirmCode?: string
) {
  try {
    const result = await getResend().emails.send({
      from: 'Kidgo <contact@kidgo.ch>',
      to: email,
      subject: 'Bestätige deine E-Mail – Kidgo',
      html: templates.confirmEmail(confirmLink, confirmCode),
    });

    if (result.error) {
      console.error('Failed to send confirmation email:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error };
  }
}
