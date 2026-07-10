require("dotenv").config();
const express = require("express");

console.log(`[startup] AI (Groq): ${process.env.GROQ_PRIMARY_KEY ? `configured (model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"})` : "NOT configured — AI features will use rule-based fallback"}`);
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const customerRoutes = require("./routes/customers.routes");
const productRoutes = require("./routes/products.routes");
const invoiceRoutes = require("./routes/invoices.routes");
const profileRoutes = require("./routes/profile.routes");
const aiRoutes = require("./routes/ai.routes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/invoicepro";

connectDB();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Sessions persisted in MongoDB (equivalent to PHP's file-based sessions/ folder)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "invoicepro_dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: "sessions" }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

// ===== API routes =====
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ai", aiRoutes);

// ===== Uploaded profile pictures =====
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== Frontend (same UI, served statically) =====
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

// Global error handler — always return JSON, never HTML
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err?.message || err);
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({ success: false, message: err?.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 InvoicePro server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Kill the process using it or set a different PORT.`);
    process.exit(1);
  } else {
    throw err;
  }
});
