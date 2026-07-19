const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/auth");
const Product = require("../models/Product");

const router = express.Router();
const upload = multer();

function toClient(p) {
  return {
    id: p._id,
    name: p.name,
    price: p.price,
    unit: p.unit,
    quantity: p.quantity,
    description: p.description
  };
}

router.use(requireAuth);

// GET /api/products?action=get
router.get("/", async (req, res) => {
  try {
    const action = req.query.action || "";
    if (action === "get") {
      const list = await Product.find({ userId: req.session.userId }).sort({ createdAt: -1 });
      return res.json({ success: true, data: list.map(toClient) });
    }
    return res.json({ success: false, message: "Invalid action." });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
});

// POST /api/products (action=add | edit | delete)
router.post("/", upload.none(), async (req, res) => {
  const action = req.body.action || "";
  const userId = req.session.userId;

  if (action === "add" || action === "edit") {
    const name = (req.body.name || "").trim();
    const price = parseFloat(req.body.price || 0);
    const unit = (req.body.unit || "").trim();
    const quantity = parseInt(req.body.quantity || 0, 10);
    const description = (req.body.description || "").trim();

    if (!name || !(price > 0)) {
      return res.json({ success: false, message: action === "add" ? "Name and price required!" : "Invalid data!" });
    }

    if (action === "add") {
      try {
        await Product.create({ userId, name, price, unit, quantity, description });
        return res.json({ success: true, message: "Product added!" });
      } catch (err) {
        return res.json({ success: false, message: "Failed to add product." });
      }
    } else {
      const id = req.body.id;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid data!" });
      try {
        const result = await Product.findOneAndUpdate(
          { _id: id, userId },
          { name, price, unit, quantity, description }
        );
        if (!result) return res.json({ success: false, message: "Product not found!" });
        return res.json({ success: true, message: "Product updated!" });
      } catch (err) {
        return res.json({ success: false, message: "Failed to update product." });
      }
    }
  }

  if (action === "delete") {
    const id = req.body.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID!" });
    try {
      await Product.findOneAndDelete({ _id: id, userId });
      return res.json({ success: true, message: "Product deleted!" });
    } catch (err) {
      return res.json({ success: false, message: "Failed to delete product." });
    }
  }

  return res.json({ success: false, message: "Invalid action." });
});

module.exports = router;
