// Renders a sample order email to email-preview.html (open it in a browser).
// Usage: npx tsx scripts/email-preview.ts
import { writeFileSync } from "node:fs";
import { renderOrderEmail } from "../src/lib/email";
const html = renderOrderEmail({
  storeName: "URL Tune Up Store", name: "Ravi Kumar", email: "ravi@example.com", orderId: "cm3x9k2abcd7f1q8",
  paidAt: new Date(), lines: [{ title: "AI Agency Automation Vault", price: 99900 }, { title: "ChatGPT Prompt Mega Pack", price: 19900 }],
  subtotal: 119800, discount: 11980, couponCode: "STAYWITHUS10", total: 107820, utr: "412345678901",
  orderUrl: "https://shop.urltuneup.com/order/x?k=y",
  items: [
    { title: "AI Agency Automation Vault", externalUrl: "https://drive.google.com/drive/folders/example" },
    { title: "ChatGPT Prompt Mega Pack", licenseKey: "UTU-7F3K-92QX-LM4P" },
    { title: "n8n Workflow Templates (ZIP)", downloadUrl: "https://shop.urltuneup.com/api/download/abc", downloadsLeft: 5 },
  ],
  supportWhatsapp: "916300983189", supportEmail: "urltuneup@gmail.com", mainSiteUrl: "https://www.urltuneup.com", expiryDays: 7,
});
writeFileSync("email-preview.html", html);
console.log("wrote email-preview.html");
