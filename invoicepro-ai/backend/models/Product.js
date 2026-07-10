const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    description: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
