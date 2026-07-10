const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    invoiceNumber: { type: String, required: true },
    issueDate: { type: String, required: true }, // stored as YYYY-MM-DD string, same as PHP DATE
    dueDate: { type: String, required: true },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "paid", "cancelled"], default: "pending" },
    items: [invoiceItemSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
