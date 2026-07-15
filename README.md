
# InvoicePro AI 🧾✨

A full-stack billing & invoicing platform with built-in AI assistance — create invoices from plain English, get automated business insights, and generate payment reminder emails in one click.

---

## 🚀 Features

- **Authentication** — Secure session-based login/signup with bcrypt password hashing, "Remember Me" support, and MongoDB-backed sessions.
- **Customer & Product Management** — Full CRUD for customers and products, with live stock tracking.
- **Invoicing** — Auto-numbered invoices (`INV-0001`, `INV-0002`, ...), itemized billing, due-date tracking, and a printable invoice view.
- **Safe Stock Deduction** — Invoice creation and stock deduction happen together using MongoDB multi-document transactions, with an automatic manual rollback fallback on standalone MongoDB setups — so stock and invoices never go out of sync, even if something fails mid-way.
- **AI Insights** — Generates 3 concise, actionable business insights (revenue, top products, low stock, collection rate) based on your live data.
- **AI Invoice Creation** — Type something like *"Invoice for John: 5 Sugar at ₹50 each"* and the AI extracts the customer, items, quantities, and pricing automatically, matching them against your existing records.
- **AI Payment Reminders** — Generates a polite, ready-to-send payment reminder email for any pending or overdue invoice.
- **Graceful AI Fallback** — If the AI service is unavailable or not configured, every AI feature falls back to a rule-based equivalent so the app never breaks.
- **File Uploads** — Profile picture upload with client-side cropping (Cropper.js).
- **Dashboard** — Live stats: total revenue, pending amount, invoice counts, and collection rate.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap, JavaScript, jQuery |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Auth | express-session, connect-mongo, bcryptjs |
| AI | Groq API (LLM inference) |
| File Uploads | Multer, Cropper.js |

---

## 📁 Project Structure

```
invoicepro-ai/
├── backend/
│   ├── server.js                 # Express app entry point
│   ├── config/db.js              # MongoDB connection
│   ├── models/                   # User, Customer, Product, Invoice
│   ├── middleware/auth.js        # Session-based route guard
│   ├── routes/
│   │   ├── auth.routes.js        # Signup / login / logout / me
│   │   ├── customers.routes.js
│   │   ├── products.routes.js
│   │   ├── invoices.routes.js    # Stats / get / add / mark paid / delete
│   │   ├── profile.routes.js     # Profile picture get / upload / remove
│   │   └── ai.routes.js          # AI insights / invoice parsing / reminders
│   ├── services/aiService.js     # Groq API integration
│   └── uploads/profiles/         # Uploaded profile pictures
│
└── frontend/
    ├── index.html                 # Landing page + login/signup modals
    ├── dashboard.html
    ├── dashboard-real.js
    └── index.js
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- MongoDB (local instance or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster)
- A free [Groq API key](https://console.groq.com) (optional — app works without it via rule-based fallback)

### Steps

```bash
git clone https://github.com/Tirth8045/AI-Invoicepro.git
cd AI-Invoicepro/backend

cp .env.example .env
# edit .env and fill in your own values (see below)

npm install
npm run dev      # or: npm start
```

The server serves both the API and the frontend — just open:

```
http://localhost:5000
```

### Environment Variables (`.env`)

```env
MONGO_URI=mongodb://127.0.0.1:27017/invoicepro
SESSION_SECRET=your_random_string
PORT=5000
CLIENT_ORIGIN=http://localhost:5000

# Optional — enables AI features
GROQ_PRIMARY_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

> ⚠️ **Never commit your real `.env` file.** Keep it listed in `.gitignore` and only commit `.env.example` with placeholder values.

SCREENSHOTS(WITH AI FEATURES)

<img width="1510" height="710" alt="Screenshot 2026-07-15 145245" src="https://github.com/user-attachments/assets/4813835e-8f93-4e62-abb9-b97d488ec54a" />

<img width="1512" height="720" alt="image" src="https://github.com/user-attachments/assets/1eaa5561-f2d9-4cdb-a3c8-51e11a280f08" />

<img width="1495" height="703" alt="image" src="https://github.com/user-attachments/assets/e6cb8456-fdd4-4e9b-bfba-26cbb9df8db6" />

<img width="1492" height="688" alt="image" src="https://github.com/user-attachments/assets/cc28f16e-b6f5-413e-b54f-4be9161e3ae2" />

<img width="1492" height="693" alt="image" src="https://github.com/user-attachments/assets/456d446f-c9a4-4194-ad41-fb83f310d2e4" />




### MongoDB Transactions Note
Multi-document transactions require MongoDB to run as a replica set (Atlas clusters have this by default). On a plain local `mongod`, the app automatically detects this and falls back to a manual rollback sequence — no extra setup needed either way. To enable real transactions locally:
```bash
mongod --replSet rs0 --dbpath /your/db/path
# then in mongosh:
rs.initiate()
```

---

## 📡 API Overview

| Endpoint | Description |
|---|---|
| `POST /api/auth/signup` / `login` / `logout` | Authentication |
| `GET /api/auth/me` | Current session check |
| `GET/POST /api/customers` | Customer CRUD |
| `GET/POST /api/products` | Product CRUD |
| `GET/POST /api/invoices` | Invoice CRUD, stats, mark-as-paid |
| `POST /api/ai/insights` | AI-generated business insights |
| `POST /api/ai/parse-invoice` | Create an invoice from natural language |
| `POST /api/ai/reminder` | AI-drafted payment reminder email |
| `GET/POST /api/profile` | Profile picture management |

---

