# InvoicePro — MERN Stack Edition

This is a **1:1 functional port** of the original PHP + MySQL "InvoicePro" project to a
**MongoDB + Express + Node.js** backend, keeping the **exact same UI/frontend**
(same Bootstrap layout, same HTML structure, same CSS, same dashboard JS logic) you already had —
only the server-side plumbing changed language and database.

> **Note on the "R" in MERN:** you asked to keep the same frontend "for ease," so the UI is
> still plain HTML/CSS/vanilla-JS + jQuery (not rewritten in React) — the same files you uploaded,
> just re-pointed at the new Node API. The **M-E-N** part (MongoDB, Express, Node) fully replaces
> PHP + MySQL. If you'd like an actual React frontend instead, say the word and I'll convert it.

---

## 1. What changed vs. the PHP version

| PHP version | MERN version |
|---|---|
| `db.php` (MySQL/mysqli) | `config/db.js` (Mongoose → MongoDB) |
| `auth.php` (signup/login) | `routes/auth.routes.js` |
| `login.php` / `register.php` (separate full pages) | Superseded by the modal-based auth already in `index.html` (same flow `auth.php` used) |
| `logout.php` | `GET /api/auth/logout` |
| `dashboard.php` (PHP session-gated page) | `dashboard.html` + client-side auth check via `GET /api/auth/me` |
| `api/customers.php`, `api/products.php`, `api/invoices.php`, `api/profile.php` | `routes/customers.routes.js`, `products.routes.js`, `invoices.routes.js`, `profile.routes.js` |
| PHP file-based sessions (`sessions/` folder) | `express-session` + `connect-mongo` (sessions stored in MongoDB) |
| MySQL auto-increment `id` | MongoDB `_id` (ObjectId, returned to the frontend as `id`) |
| `$conn->begin_transaction()` / `rollback()` for invoice + stock | Mongo session transaction (`withTransaction`) with an automatic **fallback** to a manual compensating rollback if your MongoDB isn't running as a replica set (see note below) |
| `password_hash()` / `password_verify()` (bcrypt) | `bcryptjs` (same bcrypt algorithm) |
| Profile picture upload via base64 + `file_put_contents()` | Same base64 flow, written to disk with `fs.writeFileSync()` |
| Cropper.js circle/square/free crop | Unchanged — still Cropper.js, client-side only |

Everything else — the invoice numbering scheme (`INV-0001`), stock validation, dashboard stats,
Bootstrap styling, modals, "Remember Me" cookie, the printable invoice PDF-view tab — works exactly
like before.

`login.php`, `register.php`, and `home.html` from your upload were older/duplicate full-page
variants of the login and dashboard flows respectively; the modal-based `index.html` +
`dashboard.html`/`dashboard-real.js` combo (which is what your dashboard.php actually used) is the
canonical version, so those were consolidated rather than carried over as dead code.

---

## 2. Folder structure

```
invoicepro-mern/
├── backend/
│   ├── server.js                 ← Express app entry point
│   ├── package.json
│   ├── .env.example              ← copy to .env and fill in
│   ├── config/db.js              ← MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   ├── Customer.js
│   │   ├── Product.js
│   │   └── Invoice.js            ← invoice + embedded invoice_items
│   ├── middleware/auth.js        ← session-based route guard
│   ├── routes/
│   │   ├── auth.routes.js        ← signup / login / logout / me
│   │   ├── customers.routes.js
│   │   ├── products.routes.js
│   │   ├── invoices.routes.js    ← stats / get / add / markpaid / delete
│   │   └── profile.routes.js     ← profile picture get / upload / remove
│   └── uploads/profiles/         ← uploaded profile pictures land here
│
└── frontend/                     ← same UI as your original project
    ├── index.html                ← landing page + login/signup modals (unchanged)
    ├── invoice.css                (unchanged)
    ├── index.js                  ← now calls /api/auth/... instead of auth.php
    ├── dashboard.html             ← converted from dashboard.php
    ├── dashboard-real.js          ← same dashboard logic, now calls /api/...
    └── cipat-web.jpg
```

---

## 3. Setup & run

### Prerequisites
- Node.js 18+
- MongoDB running locally, or a free MongoDB Atlas cluster

### Steps

```bash
cd invoicepro-mern/backend
cp .env.example .env
# edit .env: set MONGO_URI (and SESSION_SECRET to something random)

npm install
npm run dev      # or: npm start
```

The server serves **both** the API and the frontend, so just open:

```
http://localhost:5000
```

That's it — no separate frontend server needed. Sign up, log in, and the dashboard behaves
exactly like the PHP version.

### MongoDB Atlas (easiest, no local install)
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Get your connection string and paste it into `.env` as `MONGO_URI`
3. Atlas clusters are replica sets by default, so invoice creation will use real
   multi-document transactions automatically (see note below).

### Local standalone MongoDB
A plain `mongod` (not started with `--replSet`) doesn't support multi-document transactions.
The invoice-creation route detects this automatically and falls back to a manual
**compensating rollback** (if stock deduction fails partway through, it undoes what it already
did and deletes the invoice) — so you still get "all or nothing" behavior without needing a
replica set. If you want real transactions locally, start Mongo as a single-node replica set:
```bash
mongod --replSet rs0 --dbpath /your/db/path
# then, once connected via mongosh:
rs.initiate()
```

---

## 4. Feature checklist (same as your original CIPAT requirements table)

| Requirement | Where it lives now |
|---|---|
| Auth (email OR mobile + bcrypt) | `routes/auth.routes.js` |
| Session management | `express-session` + `connect-mongo` |
| "Remember Me" cookie | `routes/auth.routes.js` (`res.cookie('remember_email', ...)`) |
| Client + server validation | Both `index.js`/`dashboard-real.js` and every route file |
| Auth-gated dashboard | `middleware/auth.js` + client-side check in `dashboard.html` |
| Exception handling | `try/catch` throughout every route |
| File upload (profile pic) | `routes/profile.routes.js` |
| AJAX (fetch + jQuery) | `dashboard-real.js` (unchanged) |
| CRUD: Customers, Products, Invoices | All route files |
| Stock deduction on invoice creation | `routes/invoices.routes.js` (transaction + fallback) |
| Printable invoice view | `dashboard-real.js` → `viewInvoice()` (unchanged, opens a new tab) |

---

## 5. A couple of things worth knowing

- **IDs are now MongoDB ObjectId strings** (e.g. `"64fa3b2c1d0e9f0012345678"`) instead of MySQL
  auto-increment integers. The frontend JS was updated wherever it embeds an id into an
  `onclick="..."` handler, since unquoted hex strings aren't valid JavaScript — this is the one
  functional edit made to `dashboard-real.js` beyond swapping URLs.
- All API responses keep the **same JSON shape** (`{success, message, data}`) and the same field
  names your dashboard JS already expects (`customer_name`, `unit_price`, `pending_amount`, etc.),
  so nothing else in the UI logic had to change.
