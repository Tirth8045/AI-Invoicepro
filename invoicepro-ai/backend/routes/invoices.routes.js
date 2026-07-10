const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/auth");
const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const Product = require("../models/Product");

const router = express.Router();
const upload = multer();

router.use(requireAuth);

function toClient(inv, customerName) {
  return {
    id: inv._id,
    invoice_number: inv.invoiceNumber,
    issue_date: inv.issueDate,
    due_date: inv.dueDate,
    total_amount: inv.totalAmount,
    status: inv.status,
    customer_name: customerName,
    items: (inv.items || []).map((it) => ({
      product_name: it.productName,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      total: it.total
    }))
  };
}

// GET /api/invoices?action=stats|get
router.get("/", async (req, res) => {
  const action = req.query.action || "";
  const userId = req.session.userId;

  // ===================== STATS =====================
  if (action === "stats") {
    try {
      const [customers, products, invoices, pending, revenueAgg] = await Promise.all([
        Customer.countDocuments({ userId }),
        Product.countDocuments({ userId }),
        Invoice.countDocuments({ userId }),
        Invoice.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId), status: "pending" } },
          { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$totalAmount" } } }
        ]),
        Invoice.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId), status: "paid" } },
          { $group: { _id: null, sum: { $sum: "$totalAmount" } } }
        ])
      ]);

      const stats = {
        customers,
        products,
        invoices,
        pending_count: pending[0]?.count || 0,
        pending_amount: pending[0]?.sum || 0,
        revenue: revenueAgg[0]?.sum || 0
      };
      return res.json({ success: true, data: stats });
    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  // ===================== GET INVOICES =====================
  if (action === "get") {
    try {
      const invoices = await Invoice.find({ userId }).sort({ createdAt: -1 });
      const customerIds = [...new Set(invoices.map((i) => i.customerId ? i.customerId.toString() : ""))].filter(Boolean);
      const customers = await Customer.find({ _id: { $in: customerIds } });
      const nameMap = {};
      customers.forEach((c) => (nameMap[c._id.toString()] = c.name));

      const data = invoices.map((inv) => toClient(inv, (inv.customerId && nameMap[inv.customerId.toString()]) || "Unknown"));
      return res.json({ success: true, data });
    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  return res.json({ success: false, message: "Invalid action." });
});

// POST /api/invoices (action=add | markpaid | delete)
router.post("/", upload.none(), async (req, res) => {
  const body = req.body || {};
  const action = body.action || "";
  const userId = req.session.userId;

  // ===================== ADD INVOICE =====================
  if (action === "add") {
    const customerId = body.customer_id;
    const issueDate = (body.issue_date || "").trim();
    const dueDate = (body.due_date || "").trim();
    const total = parseFloat(body.total || 0);

    if (!customerId) {
      return res.json({ success: false, message: "customer not exisr" });
    }
    if (!issueDate || !dueDate) {
      return res.json({ success: false, message: "Missing required fields!" });
    }

    let items;
    try {
      items = JSON.parse(body.items || "[]");
    } catch (e) {
      items = [];
    }
    if (!items || items.length === 0) {
      return res.json({ success: false, message: "No items in invoice!" });
    }

    // ---- Server-side stock check ----
    for (const item of items) {
      const prodId = item.product_id;
      const reqQty = parseInt(item.qty || 0, 10);
      if (prodId) {
        const prod = await Product.findOne({ _id: prodId, userId });
        if (prod && reqQty > prod.quantity) {
          return res.json({
            success: false,
            message: `Insufficient stock for "${prod.name}"! Available: ${prod.quantity}`
          });
        }
      }
    }

    // ---- Generate invoice number ----
    const count = await Invoice.countDocuments({ userId });
    const invoiceNumber = "INV-" + String(count + 1).padStart(4, "0");

    // ---- Create invoice + deduct stock (atomic where possible) ----
    // Uses a MongoDB session transaction when running against a replica set / Atlas.
    // Falls back to a manual compensating-rollback sequence on standalone MongoDB
    // (where multi-document transactions are not supported), keeping the same
    // "all or nothing" guarantee described in the original PHP begin_transaction()/rollback().
    const invoiceItems = items.map((item) => ({
      productId: item.product_id || null,
      productName: (item.productName || "").trim(),
      quantity: parseInt(item.qty || 0, 10),
      unitPrice: parseFloat(item.price || 0),
      total: parseFloat(item.total || 0)
    }));

    const session = await mongoose.startSession();
    let usedTransaction = true;
    try {
      await session.withTransaction(async () => {
        const [created] = await Invoice.create(
          [
            {
              userId,
              customerId,
              invoiceNumber,
              issueDate,
              dueDate,
              totalAmount: total,
              status: "pending",
              items: invoiceItems
            }
          ],
          { session }
        );
        for (const item of invoiceItems) {
          if (item.productId) {
            await Product.updateOne(
              { _id: item.productId, userId },
              { $inc: { quantity: -item.quantity } },
              { session }
            );
          }
        }
      });
      await session.endSession();
    } catch (txErr) {
      await session.endSession();
      usedTransaction = false;

      // Fallback: standalone MongoDB without replica set support.
      // Perform the same steps sequentially and manually roll back on failure.
      const deducted = [];
      try {
        const invoiceDoc = await Invoice.create({
          userId,
          customerId,
          invoiceNumber,
          issueDate,
          dueDate,
          totalAmount: total,
          status: "pending",
          items: invoiceItems
        });

        for (const item of invoiceItems) {
          if (item.productId) {
            await Product.updateOne({ _id: item.productId, userId }, { $inc: { quantity: -item.quantity } });
            deducted.push(item);
          }
        }

        return res.json({ success: true, message: `Invoice #${invoiceNumber} created! Stock updated.` });
      } catch (fallbackErr) {
        // compensate: restore any stock we already deducted, remove the invoice
        for (const item of deducted) {
          await Product.updateOne({ _id: item.productId, userId }, { $inc: { quantity: item.quantity } });
        }
        await Invoice.deleteOne({ userId, invoiceNumber });
        return res.json({ success: false, message: "Failed: " + fallbackErr.message });
      }
    }

    if (usedTransaction) {
      return res.json({ success: true, message: `Invoice #${invoiceNumber} created! Stock updated.` });
    }
  }

  // ===================== MARK PAID =====================
  if (action === "markpaid") {
    const id = req.body.id;
    try {
      const result = await Invoice.findOneAndUpdate({ _id: id, userId }, { status: "paid" });
      if (!result) return res.json({ success: false, message: "Failed to update status." });
      return res.json({ success: true, message: "Invoice marked as paid!" });
    } catch (err) {
      return res.json({ success: false, message: "Failed to update status." });
    }
  }

  // ===================== DELETE =====================
  if (action === "delete") {
    const id = req.body.id;
    try {
      await Invoice.findOneAndDelete({ _id: id, userId });
      return res.json({ success: true, message: "Invoice deleted!" });
    } catch (err) {
      return res.json({ success: false, message: "Failed to delete invoice." });
    }
  }

  if (!["add", "markpaid", "delete"].includes(action)) {
    return res.json({ success: false, message: "Invalid action." });
  }
});

module.exports = router;
