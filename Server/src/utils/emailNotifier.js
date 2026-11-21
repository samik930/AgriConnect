import { query } from "../db/index.js";
import sendEmail from "./sendEmail.js";

/**
 * Common HTML email template wrapper
 */
const buildEmailTemplate = ({
  badgeText,
  badgeBg = "#10b981",
  title,
  farmerName,
  introText,
  detailsRows = [],
  actionBtnText,
  actionBtnUrl,
  footerNote,
}) => {
  const rowsHtml = detailsRows
    .map(
      (row) => `
      <tr>
        <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569; width: 35%; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          ${row.label}
        </td>
        <td style="padding: 8px 12px; font-size: 14px; color: #1e293b; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
          ${row.value}
        </td>
      </tr>
    `
    )
    .join("");

  const buttonHtml =
    actionBtnText && actionBtnUrl
      ? `
      <div style="text-align: center; margin: 26px 0 16px 0;">
        <a href="${actionBtnUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background: #10b981; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);">
          ${actionBtnText} →
        </a>
      </div>
    `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;">
              🌱 AgriConnect
            </div>
            <div style="font-size: 13px; opacity: 0.95; font-weight: 500;">
              Real-Time Agricultural Notification Network
            </div>
          </div>

          <!-- Body Content -->
          <div style="padding: 24px 28px;">
            <div style="display: inline-block; padding: 4px 12px; background: ${badgeBg}; color: #ffffff; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;">
              ${badgeText}
            </div>

            <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.35;">
              ${title}
            </h2>

            <p style="margin: 0 0 18px 0; font-size: 14px; color: #334155; line-height: 1.6;">
              Namaste <strong>${farmerName || "Farmer"}</strong>,
              <br />
              ${introText}
            </p>

            ${
              detailsRows.length > 0
                ? `
              <div style="margin: 18px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              </div>
            `
                : ""
            }

            ${buttonHtml}

            ${
              footerNote
                ? `
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5; font-style: italic;">
                ℹ️ ${footerNote}
              </p>
            `
                : ""
            }
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
            <p style="margin: 0 0 4px 0;">
              You received this live alert because your email is registered as a verified farmer on <strong>AgriConnect</strong>.
            </p>
            <p style="margin: 0;">
              Empowering Indian Farmers with Direct Market Access, Subsidies & Daily APMC Mandi Rates.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Helper to fetch all active farmers with emails
 */
async function getRegisteredFarmers() {
  try {
    const result = await query(
      "SELECT id, name, email, state, district FROM users WHERE role = 'farmer' AND email IS NOT NULL AND email != ''"
    );
    return result.rows;
  } catch (error) {
    console.error("[Email Notifier] Failed to query farmers list:", error);
    return [];
  }
}

/**
 * 1. Broadcast New Government Scheme
 */
export function broadcastNewScheme(scheme) {
  setImmediate(async () => {
    try {
      const farmers = await getRegisteredFarmers();
      if (farmers.length === 0) return;

      const subject = `🏛️ New Government Scheme: ${scheme.title}`;
      let successCount = 0;

      for (const farmer of farmers) {
        try {
          const html = buildEmailTemplate({
            badgeText: "🏛️ Government Scheme Alert",
            badgeBg: "#0284c7",
            title: scheme.title,
            farmerName: farmer.name,
            introText:
              "A new agricultural subsidy or government scheme has just been announced on AgriConnect. Check eligibility and apply to benefit:",
            detailsRows: [
              { label: "Scheme Title", value: scheme.title },
              { label: "Target State", value: scheme.state || "All India" },
              { label: "District / Region", value: scheme.district || "All Districts" },
              { label: "Description", value: scheme.description },
              ...(scheme.eligibility
                ? [{ label: "Eligibility Criteria", value: scheme.eligibility }]
                : []),
            ],
            actionBtnText: scheme.application_link || scheme.applicationLink ? "Apply for Scheme" : null,
            actionBtnUrl: scheme.application_link || scheme.applicationLink || null,
            footerNote:
              "Early applications receive priority verification. You can also view this under Schemes in your AgriConnect Farmer Dashboard.",
          });

          const plainText = `Namaste ${farmer.name},\n\nA new government scheme has been announced: ${scheme.title}\nState: ${scheme.state}\nDescription: ${scheme.description}\n\nLogin to AgriConnect to apply.`;

          await sendEmail(farmer.email, subject, plainText, html);
          successCount++;
        } catch (mailErr) {
          console.error(`[Email Notifier] Failed to send scheme email to ${farmer.email}:`, mailErr.message);
        }
      }

      console.log(`[Email Notifier] ✅ Sent ${successCount}/${farmers.length} scheme notification emails for "${scheme.title}"`);
    } catch (err) {
      console.error("[Email Notifier] Scheme broadcast error:", err);
    }
  });
}

/**
 * 2. Broadcast New Agricultural Technology
 */
export function broadcastNewTechnology(tech) {
  setImmediate(async () => {
    try {
      const farmers = await getRegisteredFarmers();
      if (farmers.length === 0) return;

      const subject = `🚜 New Agri-Technology Update: ${tech.title}`;
      let successCount = 0;

      for (const farmer of farmers) {
        try {
          const html = buildEmailTemplate({
            badgeText: "🚜 Modern Farming Technology",
            badgeBg: "#10b981",
            title: tech.title,
            farmerName: farmer.name,
            introText:
              "A modern agricultural technique or equipment guideline has been published to boost crop yield and optimize farming costs:",
            detailsRows: [
              { label: "Technology", value: tech.title },
              { label: "Applicable Region", value: tech.state || "All Regions" },
              { label: "Overview", value: tech.description },
            ],
            actionBtnText: tech.resource_link || tech.resourceLink ? "Explore Technology Guide" : null,
            actionBtnUrl: tech.resource_link || tech.resourceLink || null,
            footerNote:
              "Implement these scientifically backed techniques to reduce water, fertilizer, and pest management costs.",
          });

          const plainText = `Namaste ${farmer.name},\n\nA new agricultural technology has been published: ${tech.title}\nDescription: ${tech.description}\n\nVisit your AgriConnect dashboard to explore.`;

          await sendEmail(farmer.email, subject, plainText, html);
          successCount++;
        } catch (mailErr) {
          console.error(`[Email Notifier] Failed to send tech email to ${farmer.email}:`, mailErr.message);
        }
      }

      console.log(`[Email Notifier] ✅ Sent ${successCount}/${farmers.length} technology notification emails for "${tech.title}"`);
    } catch (err) {
      console.error("[Email Notifier] Tech broadcast error:", err);
    }
  });
}

/**
 * 3. Broadcast New Training Workshop
 */
export function broadcastNewTraining(training) {
  setImmediate(async () => {
    try {
      const farmers = await getRegisteredFarmers();
      if (farmers.length === 0) return;

      const dateStr = training.date
        ? new Date(training.date).toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Scheduled Session";

      const subject = `🎓 New Farmer Training: ${training.title}`;
      let successCount = 0;

      for (const farmer of farmers) {
        try {
          const html = buildEmailTemplate({
            badgeText: "🎓 KVK / ICAR Training Workshop",
            badgeBg: "#8b5cf6",
            title: training.title,
            farmerName: farmer.name,
            introText:
              "A free hands-on agricultural training workshop has been scheduled by agricultural scientists and extension officers:",
            detailsRows: [
              { label: "Workshop Title", value: training.title },
              { label: "Organizer", value: training.organizer },
              { label: "Date & Time", value: dateStr },
              { label: "Location / Mode", value: training.location || "Online Webinar / KVK Center" },
            ],
            actionBtnText: training.registration_link || training.registrationLink ? "Register for Free" : null,
            actionBtnUrl: training.registration_link || training.registrationLink || null,
            footerNote:
              "Certificates and subsidized kits may be provided upon completion by the organizing Krishi Vigyan Kendra.",
          });

          const plainText = `Namaste ${farmer.name},\n\nNew training workshop: ${training.title}\nOrganized by: ${training.organizer}\nDate: ${dateStr}\nLocation: ${training.location || "Online"}\n\nRegister via AgriConnect.`;

          await sendEmail(farmer.email, subject, plainText, html);
          successCount++;
        } catch (mailErr) {
          console.error(`[Email Notifier] Failed to send training email to ${farmer.email}:`, mailErr.message);
        }
      }

      console.log(`[Email Notifier] ✅ Sent ${successCount}/${farmers.length} training notification emails for "${training.title}"`);
    } catch (err) {
      console.error("[Email Notifier] Training broadcast error:", err);
    }
  });
}

/**
 * 4. Broadcast APMC / Mandi Daily Benchmark Market Price Update
 */
export function broadcastMarketPriceUpdate(marketPrice, isUpdate = false) {
  setImmediate(async () => {
    try {
      const farmers = await getRegisteredFarmers();
      if (farmers.length === 0) return;

      const action = isUpdate ? "Updated" : "New Daily Rate Published";
      const subject = `📈 APMC Mandi Rate Alert: ${marketPrice.crop_name || marketPrice.cropName} in ${marketPrice.district} (₹${marketPrice.market_price || marketPrice.marketPrice}/${marketPrice.unit || "kg"})`;
      let successCount = 0;

      const priceVal = parseFloat(marketPrice.market_price || marketPrice.marketPrice).toFixed(2);
      const cropName = marketPrice.crop_name || marketPrice.cropName;
      const district = marketPrice.district;
      const unit = marketPrice.unit || "kg";

      for (const farmer of farmers) {
        try {
          const html = buildEmailTemplate({
            badgeText: "📈 APMC Mandi Price Update",
            badgeBg: "#f59e0b",
            title: `Benchmark Rate: ${cropName} in ${district}`,
            farmerName: farmer.name,
            introText: `Official daily APMC / Mandi benchmark price has been ${action.toLowerCase()}. Use this benchmark rate to price your farm produce competitively:`,
            detailsRows: [
              { label: "Crop Name", value: cropName },
              { label: "Mandi District", value: district },
              { label: "Benchmark Market Price", value: `<strong style="font-size: 16px; color: #059669;">₹${priceVal}</strong> per ${unit}` },
              { label: "Effective Date", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
            ],
            actionBtnText: "List Produce on AgriConnect",
            actionBtnUrl: "http://localhost:5173",
            footerNote:
              "Benchmark rates are sourced from Agriculture Produce Market Committees (APMC) and national mandi data.",
          });

          const plainText = `Namaste ${farmer.name},\n\nAPMC Mandi Rate Update for ${cropName} in ${district}: ₹${priceVal} / ${unit}.\n\nCheck AgriConnect to list your crops at direct-to-customer rates.`;

          await sendEmail(farmer.email, subject, plainText, html);
          successCount++;
        } catch (mailErr) {
          console.error(`[Email Notifier] Failed to send market price email to ${farmer.email}:`, mailErr.message);
        }
      }

      console.log(`[Email Notifier] ✅ Sent ${successCount}/${farmers.length} market price notification emails for "${cropName}"`);
    } catch (err) {
      console.error("[Email Notifier] Market price broadcast error:", err);
    }
  });
}

