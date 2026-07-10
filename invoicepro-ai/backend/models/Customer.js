const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
