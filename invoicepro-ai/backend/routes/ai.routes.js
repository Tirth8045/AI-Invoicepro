/**
 * AI Routes — InvoicePro
 * POST /api/ai/insights        → AI Insights (3 bullet points)
 * POST /api/ai/parse-invoice   → Create Invoice with AI (text → structured JSON)
 * POST /api/ai/reminder        → AI Payment Reminder email draft
 *
 * All AI calls go through aiCall() in services/aiService.js.
 * Routes never touch API keys, providers, or models.
 */

const express = require('express');
const requireAuth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const multer = require('multer');
const { aiCall } = require('../services/aiService');

const router = express.Router();
const upload = multer();
router.use(requireAuth);

/**
 * Extract JSON from AI responses that may include markdown code fences
 * e.g.
 * 
 ```json { ... } 
 ```
 * or leading text before the JSON.
 */
function extractJson(text) {
  if (!text) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.search(/[[{]/);
  const lastBrace = candidate.lastIndexOf('}');
  const lastBracket = candidate.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (start === -1 || end === -1) return candidate.trim();
  return candidate.slice(start, end + 1).trim();
}


// 1. AI INSIGHTS — POST /api/ai/insights

router.post('/insights', upload.none(), async (req, res) => {
  try {
    const userId = req.session.userId;

    const [invoices, products] = await Promise.all([
      Invoice.find({ userId }).lean(),
      Product.find({ userId }).lean(),
    ]);

    const paid = invoices.filter((i) => i.status === 'paid');
    const pending = invoices.filter((i) => i.status === 'pending');
    const totalRevenue = paid.reduce((s, i) => s + i.totalAmount, 0);
    const totalPending = pending.reduce((s, i) => s + i.totalAmount, 0);
    const totalInvoices = invoices.length;

    const salesMap = {};
    invoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        if (!salesMap[item.productName]) salesMap[item.productName] = { qty: 0, revenue: 0 };
        salesMap[item.productName].qty += item.quantity;
        salesMap[item.productName].revenue += item.total;
      });
    });

    const topProducts = Object.entries(salesMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 3)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }));

    const lowStock = products.filter((p) => p.quantity <= 5 && p.quantity >= 0);
    const paidRate = totalInvoices > 0 ? Math.round((paid.length / totalInvoices) * 100) : 0;

    const context = `
Business data:
- Total invoices: ${totalInvoices} (${paid.length} paid, ${pending.length} pending)
- Total revenue from paid invoices: ₹${totalRevenue.toLocaleString('en-IN')}
- Outstanding pending amount: ₹${totalPending.toLocaleString('en-IN')}
- Payment collection rate: ${paidRate}%
- Top selling products: ${topProducts.map((p) => `${p.name} (${p.qty} units, ₹${p.revenue})`).join(', ') || 'No sales yet'}
- Low stock products (≤5 units): ${lowStock.map((p) => `${p.name} (${p.quantity} left)`).join(', ') || 'None'}
`;

    const prompt = `You are a business intelligence assistant for a small business invoice management system.
Based on the following business data, generate exactly 3 concise, actionable insight bullet points.
Each point should be practical, specific to the numbers, and helpful to the business owner.
Keep each point under 25 words. Return ONLY a JSON array of 3 strings, no markdown.

${context}

Example format: ["insight 1", "insight 2", "insight 3"]`;

    const aiText = await aiCall(prompt);

    let insights;
    if (aiText) {
      try {
        insights = JSON.parse(extractJson(aiText));
        if (!Array.isArray(insights)) throw new Error('Not array');
        insights = insights.slice(0, 3);
      } catch {
        insights = aiText.split('\n').filter((l) => l.trim().length > 5).slice(0, 3);
      }
    } else {
      insights = [];
      if (totalPending > 0) {
        insights.push(
          `Focus on collecting the outstanding amount of ₹${totalPending.toLocaleString('en-IN')}. Consider sending payment reminders to clients with overdue invoices.`
        );
      } else {
        insights.push('All invoices are paid — excellent cash flow! Keep maintaining timely billing to sustain this momentum.');
      }
      if (topProducts.length > 0) {
        insights.push(
          `Your best-selling product is "${topProducts[0].name}" generating ₹${topProducts[0].revenue.toLocaleString('en-IN')} in revenue. Consider increasing stock levels.`
        );
      } else {
        insights.push('Start adding products and creating invoices to get AI-powered product performance insights.');
      }
      if (lowStock.length > 0) {
        insights.push(
          `⚠️ Low stock alert: ${lowStock.map((p) => p.name).join(', ')} ${lowStock.length === 1 ? 'is' : 'are'} running low. Restock soon to avoid missed sales.`
        );
      } else if (paidRate >= 70) {
        insights.push(`Your payment rate is ${paidRate}% — well above average. Your invoicing process is working effectively.`);
      } else {
        insights.push(`Your payment collection rate is ${paidRate}%. Consider adding payment terms or sending earlier reminders to improve cash flow.`);
      }
    }

    return res.json({ success: true, insights });
  } catch (err) {
    console.error('AI insights error:', err);
    return res.json({ success: false, message: err.message });
  }
});


// 2. CREATE INVOICE WITH AI — POST /api/ai/parse-invoice

router.post('/parse-invoice', upload.none(), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { text } = req.body;

    if (!text || text.trim().length < 5) {
      return res.json({ success: false, message: 'Please provide invoice details text.' });
    }

    const [customers, products] = await Promise.all([
      Customer.find({ userId }).lean(),
      Product.find({ userId }).lean(),
    ]);

    const customerList = customers.map((c) => ({ id: c._id, name: c.name, email: c.email }));
    const productList = products.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.price,
      unit: p.unit,
      quantity: p.quantity,
    }));

    const today = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const dueDate = due.toISOString().split('T')[0];

    const prompt = `You are an invoice data extraction AI for a billing system.
Extract invoice details from the user's text and match against the available customers and products.

User's text: "${text}"

Available customers (match by name similarity):
${JSON.stringify(customerList)}

Available products (match by name similarity, check stock):
${JSON.stringify(productList)}

Today's date: ${today}

Return ONLY a JSON object (no markdown, no extra text):
{
  "customer_id": "<matched customer _id or null>",
  "customer_name": "<matched customer name or extracted name>",
  "customer_email": "<extracted customer email or null if not found>",
  "customer_mobile": "<extracted customer mobile/phone number or null if not found>",
  "issue_date": "<YYYY-MM-DD, default today>",
  "due_date": "<YYYY-MM-DD, default 30 days from today>",
  "items": [
    {
      "product_id": "<matched product _id or null>",
      "product_name": "<product name>",
      "qty": <number>,
      "price": <unit price as number>,
      "total": <qty * price>,
      "stock_available": <product quantity or 999 if not matched>,
      "stock_warning": <true if qty > stock_available>
    }
  ],
  "total": <sum of all item totals>,
  "notes": "<any relevant notes or warnings extracted>"
}

Rules:
- Match customer by name (case-insensitive, partial match OK)
- Match products by name (case-insensitive, partial match OK)
- If product not found in list, still include it with product_id: null
- Use the product's listed price if qty is given without price
- Flag stock_warning: true if requested qty exceeds available stock
- Extract the customer's email and mobile/phone number if present in the user's text.
- Return valid JSON only`;

    const aiText = await aiCall(prompt);

    let parsed;
    if (aiText) {
      try {
        parsed = JSON.parse(extractJson(aiText));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return res.json({
            success: false,
            message: "AI could not parse the invoice text. Please be more specific, e.g. 'Invoice for John: 5 Sugar at ₹50 each'.",
          });
        }
      } catch {
        return res.json({
          success: false,
          message: "AI could not parse the invoice text. Please be more specific, e.g. 'Invoice for John: 5 Sugar at ₹50 each'.",
        });
      }
    } else {
      parsed = fallbackParseInvoice(text, customers, products, today);
    }

    // Do NOT auto-create customers
    if (!parsed.customer_id && parsed.customer_name) {
      return res.json({
        success: false,
        message: `Customer "${parsed.customer_name}" does not exist. Please add the customer first and try again.`,
      });
    }

    // Always auto-set dates for AI-created invoices
    parsed.issue_date = parsed.issue_date && String(parsed.issue_date).trim().length > 0 ? parsed.issue_date : today;
    parsed.due_date = parsed.due_date && String(parsed.due_date).trim().length > 0 ? parsed.due_date : dueDate;

    // Compute stock warnings
    const stockWarnings = [];
    if (parsed.items) {
      parsed.items.forEach((item) => {
        if (item.product_id) {
          const prod = products.find((p) => p._id.toString() === String(item.product_id));
          if (prod && item.qty > prod.quantity) {
            stockWarnings.push(`"${item.product_name}" only has ${prod.quantity} in stock but you requested ${item.qty}`);
            item.stock_warning = true;
            item.stock_available = prod.quantity;
          }
        }
      });
    }

    return res.json({ success: true, data: parsed, stockWarnings });
  } catch (err) {
    console.error('AI parse invoice error:', err);
    return res.json({ success: false, message: err.message });
  }
});

// Rule-based fallback parser (used when AI returns null)
function fallbackParseInvoice(text, customers, products, today) {
  const due = new Date();
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().split('T')[0];

  let customerEmail = null;
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) customerEmail = emailMatch[0];

  let customerMobile = null;
  const mobileMatch = text.match(/\b\d{10}\b/);
  if (mobileMatch) customerMobile = mobileMatch[0];

  let customerId = null;
  let customerName = '';
  for (const c of customers) {
    if (text.toLowerCase().includes(c.name.toLowerCase())) {
      customerId = c._id.toString();
      customerName = c.name;
      break;
    }
  }

  if (!customerId) {
    const nameMatch = text.match(/(?:invoice for|bill to|to|customer:?|client:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    customerName = nameMatch ? nameMatch[1].trim() : 'New Customer';
  }

  const items = [];
  for (const p of products) {
    const escapedName = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(\\d+)\\s*(?:x|units?|kg|pcs?)?\\s*${escapedName}|${escapedName}\\s*(?:x|:)?\\s*(\\d+)`,
      'i'
    );
    const m = text.match(re);
    if (m) {
      const qty = parseInt(m[1] || m[2] || 1);
      items.push({
        product_id: p._id.toString(),
        product_name: p.name,
        qty,
        price: p.price,
        total: qty * p.price,
        stock_available: p.quantity,
        stock_warning: qty > p.quantity,
      });
    }
  }

  const total = items.reduce((s, i) => s + i.total, 0);
  return {
    customer_id: customerId,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_mobile: customerMobile,
    issue_date: today,
    due_date: dueDate,
    items,
    total,
    notes: '',
  };
}


// 3. AI PAYMENT REMINDER — POST /api/ai/reminder

router.post('/reminder', upload.none(), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { invoice_id } = req.body;

    if (!invoice_id) return res.json({ success: false, message: 'invoice_id required' });

    const invoice = await Invoice.findOne({ _id: invoice_id, userId }).lean();
    if (!invoice) return res.json({ success: false, message: 'Invoice not found' });

    const customer = await Customer.findById(invoice.customerId).lean();
    const customerName = customer?.name || 'Client';
    const customerEmail = customer?.email || '';

    const dueDate = invoice.dueDate;
    const amount = parseFloat(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const isOverdue = new Date(dueDate) < new Date();
    const itemsSummary = (invoice.items || []).map((i) => `${i.productName} x${i.quantity}`).join(', ');

    const prompt = `Write a professional, friendly payment reminder email for the following invoice.
Keep it polite, concise and professional. Include the key details naturally.

Invoice Number: ${invoice.invoiceNumber}
Client Name: ${customerName}
Client Email: ${customerEmail}
Amount Due: ₹${amount}
Due Date: ${dueDate}
Status: ${isOverdue ? 'OVERDUE' : 'Due soon'}
Items: ${itemsSummary}

Format the email as plain text with Subject on the first line, then a blank line, then the email body.
Do NOT use markdown. Start with: Subject: ...`;

    const aiText = await aiCall(prompt);

    let emailText;
    if (aiText) {
      emailText = aiText.trim();
    } else {
      const overdueNote = isOverdue ? 'This invoice is now overdue. ' : `This invoice is due on ${dueDate}. `;
      emailText = `Subject: ${isOverdue ? 'Overdue' : 'Friendly Reminder'}: Invoice ${invoice.invoiceNumber} Due

Dear ${customerName},

I hope this message finds you well.

${overdueNote}This is a friendly reminder that invoice ${invoice.invoiceNumber} for ₹${amount}, due on ${dueDate}, is awaiting payment.

Invoice Details:
- Invoice #: ${invoice.invoiceNumber}
- Amount: ₹${amount}
- Due Date: ${dueDate}
- Items: ${itemsSummary}

Could you please remit payment at your earliest convenience? If payment has already been sent, please disregard this email.

If you have any questions regarding this invoice, feel free to reach out.

Thank you for your business!

Best regards,
InvoicePro Team`;
    }

    return res.json({ success: true, email: emailText });
  } catch (err) {
    console.error('AI reminder error:', err);
    return res.json({ success: false, message: err.message });
  }
});

module.exports = router;

