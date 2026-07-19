const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/auth");
const Customer = require("../models/Customer");

const router = express.Router();
const upload = multer();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{10}$/;

function toClient(c) {
  return { id: c._id, name: c.name, email: c.email, phone: c.phone };
}

router.use(requireAuth);

// GET  /api/customers?action=get
router.get("/", async (req, res) => {
  try {
    const action = req.query.action || "";
    if (action === "get") {
      const list = await Customer.find({ userId: req.session.userId }).sort({ createdAt: -1 });
      return res.json({ success: true, data: list.map(toClient) });
    }
    return res.json({ success: false, message: "Invalid action!" });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
});

// POST /api/customers  (action=add | edit | delete)
router.post("/", upload.none(), async (req, res) => {
  const action = req.body.action || "";
  const userId = req.session.userId;

  if (action === "add" || action === "edit") {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim();
    const phone = (req.body.phone || "").trim();

    if (!name || !email || !phone) {
      return res.json({ success: false, message: "Please fill all fields!" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.json({ success: false, message: "Invalid email!" });
    }
    if (!PHONE_RE.test(phone)) {
      return res.json({ success: false, message: "Enter valid 10-digit phone!" });
    }

    if (action === "add") {
      try {
        await Customer.create({ userId, name, email, phone });
        return res.json({ success: true, message: "Customer added!" });
      } catch (err) {
        return res.json({ success: false, message: "Failed to add customer: " + err.message });
      }
    } else {
      const id = req.body.id;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID!" });
      try {
        const result = await Customer.findOneAndUpdate(
          { _id: id, userId },
          { name, email, phone }
        );
        if (!result) return res.json({ success: false, message: "Customer not found!" });
        return res.json({ success: true, message: "Customer updated!" });
      } catch (err) {
        return res.json({ success: false, message: "Failed to update!" });
      }
    }
  }

  if (action === "delete") {
    const id = req.body.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID!" });
    try {
      await Customer.findOneAndDelete({ _id: id, userId });
      return res.json({ success: true, message: "Customer deleted!" });
    } catch (err) {
      return res.json({ success: false, message: "Failed to delete!" });
    }
  }

  return res.json({ success: false, message: "Invalid action!" });
});

module.exports = router;
