/**
 * PII Sanitizer & Prompt Injection Cleansing Utilities for MCP Agents
 */

/**
 * Mask phone numbers: +91 9876543210 -> +91 ******3210
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return phone;
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) return "******";
  return cleaned.slice(0, 3) + "******" + cleaned.slice(-4);
}

/**
 * Mask email addresses: samikpodder396@gmail.com -> s***6@gmail.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Recursively cleanse sensitive fields (passwords, auth tokens, unmasked PII) from tool outputs
 */
export function sanitizeData(obj, depth = 0) {
  if (depth > 6 || obj == null) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeData(item, depth + 1));
  }

  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Drop sensitive authentication / credential fields completely
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey === "otp" ||
        lowerKey === "otps" ||
        lowerKey.includes("jwt")
      ) {
        continue;
      }

      // Mask phone numbers
      if (lowerKey === "phone" || lowerKey === "phonenumber") {
        sanitized[key] = maskPhone(val);
        continue;
      }

      // Mask email for public directory / farmer listings
      if (lowerKey === "email" && typeof val === "string") {
        sanitized[key] = maskEmail(val);
        continue;
      }

      sanitized[key] = sanitizeData(val, depth + 1);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Strip potential prompt injection control tokens and markdown escaping from user messages
 */
export function sanitizeUserInput(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<system[\s\S]*?<\/system>/gi, "")
    .replace(/\[SYSTEM\s+INSTRUCTION[\s\S]*?\]/gi, "")
    .replace(/\{\{\s*system[\s\S]*?\}\}/gi, "")
    .trim();
}

