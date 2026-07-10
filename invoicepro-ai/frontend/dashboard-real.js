// ============================================================
// =================== SIDEBAR TOGGLE ========================
// ============================================================
document.getElementById("menuToggle").addEventListener("click", function () {
  document.getElementById("sidebar").classList.toggle("d-none");
});

// ============================================================
// =================== PAGE NAVIGATION =======================
// ============================================================
document.querySelectorAll(".menu-link").forEach(function (link) {
  link.addEventListener("click", function (e) {
    e.preventDefault();
    var pageId = this.getAttribute("data-page");
    document.querySelectorAll(".page").forEach(function (page) { page.classList.add("d-none"); });
    document.getElementById(pageId).classList.remove("d-none");
    document.querySelectorAll(".menu-link").forEach(function (l) { l.classList.remove("active"); });
    this.classList.add("active");
    if (pageId === "customers") { loadCustomers(); }
    if (pageId === "products") { loadProducts(); }
    if (pageId === "invoices") { loadInvoices(); }
    if (pageId === "createInvoice") { setupCreateInvoicePage(); }
    if (pageId === "dashboard") { loadDashboardStats(); }
  });
});

// ============================================================
// =================== HELPER FUNCTIONS ======================
// ============================================================
function apiPost(url, data, callback) {
  var formData = new FormData();
  for (var key in data) { formData.append(key, data[key]); }
  fetch(url, { method: "POST", body: formData, credentials: "same-origin" })
    .then(function (res) { return res.json(); })
    .then(function (result) { callback(result); })
    .catch(function (err) {
      console.error("apiPost error:", err);
      alert("Server error! Make sure the backend server is running. (" + err.message + ")");
    });
}

function apiGet(url, callback) {
  fetch(url, { credentials: "same-origin" })
    .then(function (res) { return res.json(); })
    .then(function (result) { callback(result); })
    .catch(function (err) {
      console.error("apiGet error:", err);
      alert("Server error! Make sure the backend server is running. (" + err.message + ")");
    });
}

// ============================================================
// =================== DASHBOARD STATS =======================
// ============================================================
function loadDashboardStats() {
  apiGet("/api/invoices?action=stats", function (result) {
    if (result.success) {
      var d = result.data;
      document.getElementById("statCustomers").innerText = d.customers;
      document.getElementById("statProducts").innerText = d.products;
      document.getElementById("statInvoices").innerText = d.invoices;
      document.getElementById("statPendingCount").innerText = d.pending_count;
      document.getElementById("statPendingAmount").innerText = "₹" + parseFloat(d.pending_amount || 0).toLocaleString("en-IN");
      document.getElementById("statRevenue").innerText = "₹" + parseFloat(d.revenue || 0).toLocaleString("en-IN");
    }
  });
}

// ============================================================
// ===================== CUSTOMERS ===========================
// ============================================================
var customers = [];
var editingCustomerId = -1;

function loadCustomers() {
  var tbody = document.getElementById("customerTable");
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3">Loading...</td></tr>';
  apiGet("/api/customers?action=get", function (result) {
    customers = result.data || [];
    renderCustomers();
  });
}

function renderCustomers() {
  var tbody = document.getElementById("customerTable");
  if (!tbody) return;
  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No customers yet.</td></tr>';
    return;
  }
  var html = "";
  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    html += '<tr><td>' + (i + 1) + '</td><td>' + c.name + '</td><td>' + c.email + '</td><td>' + c.phone + '</td><td>' +
      '<button class="btn btn-warning btn-sm me-1" onclick="openCustomerModal(\'' + c.id + '\')">Edit</button>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteCustomer(\'' + c.id + '\')">Delete</button>' +
      '</td></tr>';
  }
  tbody.innerHTML = html;
}

function openCustomerModal(id) {
  editingCustomerId = id || -1;
  if (editingCustomerId !== -1) {
    var cust = customers.find(function (c) { return c.id == id; });
    if (cust) {
      document.getElementById("custName").value = cust.name;
      document.getElementById("custEmail").value = cust.email;
      document.getElementById("custPhone").value = cust.phone;
    }
    document.getElementById("customerModalTitle").innerText = "Edit Customer";
    document.getElementById("customerSaveBtn").innerText = "Update";
  } else {
    document.getElementById("custName").value = "";
    document.getElementById("custEmail").value = "";
    document.getElementById("custPhone").value = "";
    document.getElementById("customerModalTitle").innerText = "Add Customer";
    document.getElementById("customerSaveBtn").innerText = "Save";
  }
  document.getElementById("customerModal").style.display = "flex";
}

function closeCustomerModal() {
  document.getElementById("customerModal").style.display = "none";
  editingCustomerId = -1;
}

function saveCustomer() {
  var name = document.getElementById("custName").value.trim();
  var email = document.getElementById("custEmail").value.trim();
  var phone = document.getElementById("custPhone").value.trim();
  if (!name || !email || !phone) { alert("Please fill all fields!"); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert("Invalid email!"); return; }
  if (!/^[0-9]{10}$/.test(phone)) { alert("Enter valid 10-digit phone!"); return; }
  var data = { name: name, email: email, phone: phone };
  data.action = editingCustomerId !== -1 ? "edit" : "add";
  if (editingCustomerId !== -1) data.id = editingCustomerId;
  apiPost("/api/customers", data, function (result) {
    if (result.success) { closeCustomerModal(); loadCustomers(); loadDashboardStats(); }
    else { alert(result.message); }
  });
}

function deleteCustomer(id) {
  if (!confirm("Delete this customer?")) return;
  apiPost("/api/customers", { action: "delete", id: id }, function (result) {
    if (result.success) { loadCustomers(); loadDashboardStats(); }
    else { alert(result.message); }
  });
}

// ============================================================
// ===================== PRODUCTS ============================
// ============================================================
var products = [];
var editingProductId = -1;

function loadProducts() {
  var tbody = document.getElementById("productTable");
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3">Loading...</td></tr>';
  apiGet("/api/products?action=get", function (result) {
    products = result.data || [];
    renderProducts();
  });
}

function renderProducts() {
  var tbody = document.getElementById("productTable");
  if (!tbody) return;
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No products yet.</td></tr>';
    return;
  }
  var html = "";
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var qty = parseInt(p.quantity) || 0;
    var qtyBadge = qty <= 0
      ? '<span class="badge bg-danger">Out of Stock</span>'
      : '<span class="badge bg-success">' + qty + ' in stock</span>';
    html += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + p.name + '</td>' +
      '<td>₹' + parseFloat(p.price).toLocaleString("en-IN") + '</td>' +
      '<td>' + (p.unit || "-") + '</td>' +
      '<td>' + qtyBadge + '</td>' +
      '<td>' + (p.description || "-") + '</td>' +
      '<td>' +
      '<button class="btn btn-warning btn-sm me-1" onclick="openProductModal(\'' + p.id + '\')">Edit</button>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteProduct(\'' + p.id + '\')">Delete</button>' +
      '</td></tr>';
  }
  tbody.innerHTML = html;
}

function openProductModal(id) {
  editingProductId = id || -1;
  if (editingProductId !== -1) {
    var prod = products.find(function (p) { return p.id == id; });
    if (prod) {
      document.getElementById("prodName").value = prod.name;
      document.getElementById("prodPrice").value = prod.price;
      document.getElementById("prodUnit").value = prod.unit || "";
      document.getElementById("prodQty").value = prod.quantity || 0;
      document.getElementById("prodDesc").value = prod.description || "";
    }
    document.getElementById("productModalTitle").innerText = "Edit Product";
    document.getElementById("productSaveBtn").innerText = "Update";
  } else {
    document.getElementById("prodName").value = "";
    document.getElementById("prodPrice").value = "";
    document.getElementById("prodUnit").value = "";
    document.getElementById("prodQty").value = 0;
    document.getElementById("prodDesc").value = "";
    document.getElementById("productModalTitle").innerText = "Add Product";
    document.getElementById("productSaveBtn").innerText = "Save";
  }
  document.getElementById("productModal").style.display = "flex";
}

function closeProductModal() {
  document.getElementById("productModal").style.display = "none";
  editingProductId = -1;
}

function saveProduct() {
  var name = document.getElementById("prodName").value.trim();
  var price = document.getElementById("prodPrice").value.trim();
  var unit = document.getElementById("prodUnit").value.trim();
  var qty = document.getElementById("prodQty").value.trim();
  var desc = document.getElementById("prodDesc").value.trim();
  if (!name) { alert("Product name required!"); return; }
  if (!price || isNaN(price) || price <= 0) { alert("Enter valid price!"); return; }
  if (qty === "" || isNaN(qty) || parseInt(qty) < 0) { alert("Enter valid stock quantity (0 or more)!"); return; }
  var data = { name: name, price: price, unit: unit, quantity: parseInt(qty), description: desc };
  data.action = editingProductId !== -1 ? "edit" : "add";
  if (editingProductId !== -1) data.id = editingProductId;
  apiPost("/api/products", data, function (result) {
    if (result.success) { closeProductModal(); loadProducts(); loadDashboardStats(); }
    else { alert(result.message); }
  });
}

function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  apiPost("/api/products", { action: "delete", id: id }, function (result) {
    if (result.success) { loadProducts(); loadDashboardStats(); }
    else { alert(result.message); }
  });
}

// ============================================================
// =================== CREATE INVOICE ========================
// ============================================================
var invoiceRowCounter = 0;

function setupCreateInvoicePage(callback) {
  apiGet("/api/customers?action=get", function (result) {
    customers = result.data || [];
    var sel = document.getElementById("invoiceCustomer");
    sel.innerHTML = '<option value="">-- Select Customer --</option>';
    customers.forEach(function (c) {
      sel.innerHTML += '<option value="' + c.id + '">' + c.name + '</option>';
    });

    apiGet("/api/products?action=get", function (prodResult) {
      products = prodResult.data || [];

      var today = new Date().toISOString().split("T")[0];
      document.getElementById("invoiceDate").value = today;
      document.getElementById("invoiceDueDate").value = "";
      invoiceRowCounter = 0;
      document.getElementById("invoiceItemsBody").innerHTML = "";
      addInvoiceRow();
      document.getElementById("invoiceGrandTotal").innerText = "₹0.00";

      if (typeof callback === "function") {
        callback();
      }
    });
  });
}

function buildProductOptions() {
  var html = '<option value="">-- Select Product --</option>';
  products.forEach(function (p) {
    var qty = parseInt(p.quantity) || 0;
    var label = qty <= 0 ? p.name + " [Out of Stock]" : p.name + " [Stock: " + qty + "]";
    html += '<option value="' + p.id + '" data-price="' + p.price + '" data-qty="' + qty + '" data-name="' + p.name + '">' + label + '</option>';
  });
  return html;
}

function addInvoiceRow() {
  invoiceRowCounter++;
  var rowId = "invRow" + invoiceRowCounter;
  var rowNum = invoiceRowCounter;
  var tr = document.createElement("tr");
  tr.id = rowId;
  tr.innerHTML =
    '<td><select class="form-select form-select-sm prod-select" onchange="onProductSelect(this,\'' + rowId + '\')">' + buildProductOptions() + '</select></td>' +
    '<td><input type="number" class="form-control form-control-sm qty-input" value="1" min="1" oninput="calcRow(\'' + rowId + '\')"></td>' +
    '<td><input type="number" class="form-control form-control-sm price-input" value="0" min="0" oninput="calcRow(\'' + rowId + '\')"></td>' +
    '<td><input type="number" class="form-control form-control-sm row-total" value="0" readonly></td>' +
    '<td>' + (rowNum > 1 ? '<button class="btn btn-sm btn-outline-danger" onclick="removeRow(\'' + rowId + '\')">✕</button>' : '') + '</td>';
  document.getElementById("invoiceItemsBody").appendChild(tr);
}

function onProductSelect(selectEl, rowId) {
  var price = parseFloat(selectEl.options[selectEl.selectedIndex].getAttribute("data-price")) || 0;
  document.getElementById(rowId).querySelector(".price-input").value = price;
  calcRow(rowId);
}

function calcRow(rowId) {
  var row = document.getElementById(rowId);
  var qty = parseFloat(row.querySelector(".qty-input").value) || 0;
  var price = parseFloat(row.querySelector(".price-input").value) || 0;
  row.querySelector(".row-total").value = (qty * price).toFixed(2);
  calcGrandTotal();
}

function calcGrandTotal() {
  var grand = 0;
  document.querySelectorAll(".row-total").forEach(function (i) { grand += parseFloat(i.value) || 0; });
  document.getElementById("invoiceGrandTotal").innerText = "₹" + grand.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function removeRow(rowId) {
  var row = document.getElementById(rowId);
  if (row) row.remove();
  calcGrandTotal();
}

function saveInvoice() {
  var customerId = document.getElementById("invoiceCustomer").value;
  var invoiceDate = document.getElementById("invoiceDate").value;
  var dueDate = document.getElementById("invoiceDueDate").value;
  if (!customerId) { alert("Please select a customer!"); return; }
  if (!invoiceDate) { alert("Please select invoice date!"); return; }
  if (!dueDate) { alert("Please select due date!"); return; }

  var items = [];
  var grand = 0;
  var stockError = null;

  document.querySelectorAll("#invoiceItemsBody tr").forEach(function (row) {
    var sel = row.querySelector(".prod-select");
    var selOpt = sel.options[sel.selectedIndex];
    var prodId = sel.value;
    var prodName = selOpt.getAttribute("data-name") || selOpt.text;
    var availQty = parseInt(selOpt.getAttribute("data-qty")) || 0;
    var qty = parseFloat(row.querySelector(".qty-input").value) || 0;
    var price = parseFloat(row.querySelector(".price-input").value) || 0;
    var total = parseFloat(row.querySelector(".row-total").value) || 0;
    if (prodId && qty > 0) {
      if (!stockError && qty > availQty) {
        stockError = "Not enough stock for \"" + prodName + "\"!\nAvailable: " + availQty + "  |  You entered: " + qty;
      }
      items.push({ product_id: prodId, productName: prodName, qty: qty, price: price, total: total });
      grand += total;
    }
  });

  if (items.length === 0) { alert("Please add at least one product!"); return; }
  if (stockError) { alert(stockError); return; }

  apiPost("/api/invoices", {
    action: "add", customer_id: customerId,
    issue_date: invoiceDate, due_date: dueDate,
    items: JSON.stringify(items), total: grand
  }, function (result) {
    if (result.success) { alert(result.message); setupCreateInvoicePage(); loadDashboardStats(); loadProducts(); }
    else { alert(result.message); }
  });
}

// ============================================================
// ==================== INVOICES LIST ========================
// ============================================================
var invoicesList = [];

function loadInvoices() {
  var tbody = document.getElementById("invoicesTable");
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3">Loading...</td></tr>';
  apiGet("/api/invoices?action=get", function (result) {
    invoicesList = result.data || [];
    renderInvoices();
    loadAIInsights(); // Load AI insights each time invoices page is shown
  });
}

function renderInvoices() {
  var tbody = document.getElementById("invoicesTable");
  if (!tbody) return;
  if (invoicesList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No invoices yet.</td></tr>';
    return;
  }
  var html = "";
  for (var i = 0; i < invoicesList.length; i++) {
    var inv = invoicesList[i];
    var badge = inv.status === "paid" ? '<span class="badge bg-success">Paid</span>' : '<span class="badge bg-warning text-dark">Pending</span>';
    var paidBtn = inv.status === "pending" ? '<button class="btn btn-success btn-sm me-1" onclick="markPaid(\'' + inv.id + '\')">Mark Paid</button>' : '';
    var reminderBtn = '<button class="btn btn-outline-secondary btn-sm me-1" title="AI Payment Reminder" onclick="openAIReminder(\'' + inv.id + '\')"><i class="fa fa-envelope"></i></button>';
    html += '<tr><td>' + inv.invoice_number + '</td><td>' + inv.customer_name + '</td><td>' + inv.issue_date + '</td><td>' + inv.due_date + '</td>' +
      '<td>₹' + parseFloat(inv.total_amount).toLocaleString("en-IN") + '</td><td>' + badge + '</td><td>' +
      paidBtn +
      '<button class="btn btn-primary btn-sm me-1" onclick="viewInvoice(' + i + ')">View PDF</button>' +
      reminderBtn +
      '<button class="btn btn-danger btn-sm" onclick="deleteInvoice(\'' + inv.id + '\')">Delete</button>' +
      '</td></tr>';
  }
  tbody.innerHTML = html;
}

function markPaid(id) {
  apiPost("/api/invoices", { action: "markpaid", id: id }, function (result) {
    if (result.success) { loadInvoices(); loadDashboardStats(); }
    else { alert(result.message); }
  });
}

function deleteInvoice(id) {
  if (!confirm("Delete this invoice?")) return;
  apiPost("/api/invoices", { action: "delete", id: id }, function (result) {
    if (result.success) { loadInvoices(); loadDashboardStats(); }
    else { alert(result.message); }
  });
}

function viewInvoice(index) {
  var inv = invoicesList[index];
  var rows = "";
  inv.items.forEach(function (item) {
    rows += '<tr><td>' + item.product_name + '</td><td style="text-align:center">' + item.quantity + '</td>' +
      '<td style="text-align:right">₹' + parseFloat(item.unit_price).toLocaleString("en-IN") + '</td>' +
      '<td style="text-align:right">₹' + parseFloat(item.total).toLocaleString("en-IN") + '</td></tr>';
  });
  var sc = inv.status === "paid" ? "#198754" : "#ffc107";
  var st = inv.status === "paid" ? "PAID" : "PENDING";
  var win = window.open("", "_blank");
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ' + inv.invoice_number + '</title>' +
    '<style>body{font-family:Arial,sans-serif;padding:40px;color:#333}.header{display:flex;justify-content:space-between;border-bottom:3px solid #0d6efd;padding-bottom:16px;margin-bottom:24px}' +
    '.brand{font-size:28px;font-weight:800;color:#0d6efd}.inv-meta{text-align:right;font-size:14px}.inv-meta h3{margin:0 0 6px;color:#0d6efd}' +
    '.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;color:' + (inv.status === "paid" ? "#fff" : "#333") + ';background:' + sc + ';margin-top:6px}' +
    '.bill-to{margin-bottom:24px}.bill-to h6{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}.bill-to p{font-size:16px;font-weight:600;margin:0}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#0d6efd;color:white}th,td{padding:10px 14px;border:1px solid #dee2e6;font-size:14px}' +
    '.total-row td{font-weight:700;background:#f8f9fa}.footer{margin-top:40px;font-size:12px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}' +
    '.print-btn{display:block;margin:24px auto 0;padding:10px 30px;background:#0d6efd;color:white;border:none;border-radius:6px;font-size:15px;cursor:pointer}' +
    '@media print{.print-btn{display:none}}</style></head><body>' +
    '<div class="header"><div><div class="brand">InvoicePro</div><div style="font-size:13px;color:#888;margin-top:4px">Professional Invoicing System</div></div>' +
    '<div class="inv-meta"><h3>' + inv.invoice_number + '</h3><div>Date: <strong>' + inv.issue_date + '</strong></div><div>Due: <strong>' + inv.due_date + '</strong></div>' +
    '<span class="badge">' + st + '</span></div></div>' +
    '<div class="bill-to"><h6>Bill To</h6><p>' + inv.customer_name + '</p></div>' +
    '<table><thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>' +
    '<tbody>' + rows + '</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:right">Grand Total</td>' +
    '<td style="text-align:right">₹' + parseFloat(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) + '</td></tr></tfoot></table>' +
    '<div class="footer">Thank you for your business! — InvoicePro</div>' +
    '<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button></body></html>');
  win.document.close();
}

// ============================================================
// ===================== ON PAGE LOAD ========================
// ============================================================
// Called by dashboard.html once /api/auth/me confirms a valid session
// (replaces the PHP pattern where dashboard.php itself blocked access server-side).
window.initDashboardApp = function () {
  loadDashboardStats();
  loadCustomers();
  loadProducts();
  loadInvoices();
  loadProfilePic();
};

// ============================================================
// ================== PROFILE PICTURE ========================
// ============================================================
var cropperObj = null;
var currentCropShape = 'circle';

function loadProfilePic() {
  $.ajax({
    url: "/api/profile?action=get",
    success: function (result) {
      if (result.success && result.data && result.data.profile_pic) {
        var src = result.data.profile_pic + "?t=" + Date.now();
        $("#navProfilePic").attr("src", src);
        $("#profileModalPic").attr("src", src);
      }
    }
  });
}

function openProfileModal() {
  var src = $("#navProfilePic").attr("src");
  $("#profileModalPic").attr("src", src);
  document.getElementById("profileModal").style.display = "flex";
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
}

function onProfileFileSelected(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { alert("Image too large! Max 5MB."); return; }
  var reader = new FileReader();
  reader.onload = function (e) {
    closeProfileModal();
    openCropperModal(e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = "";
}

function openCropperModal(imageSrc) {
  document.getElementById("cropperModal").style.display = "flex";
  document.getElementById("cropperImage").src = imageSrc;
  setTimeout(function () {
    if (cropperObj) { cropperObj.destroy(); cropperObj = null; }
    cropperObj = new Cropper(document.getElementById("cropperImage"), {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      preview: '#cropPreview',
      ready: function () { setCropShape(currentCropShape); }
    });
  }, 200);
}

function closeCropperModal() {
  if (cropperObj) { cropperObj.destroy(); cropperObj = null; }
  document.getElementById("cropperModal").style.display = "none";
}

function setCropShape(shape) {
  currentCropShape = shape;
  document.querySelectorAll('#btnCircle,#btnSquare,#btnFree').forEach(function (b) { b.classList.remove('active'); });
  if (shape === 'circle') {
    document.getElementById('btnCircle').classList.add('active');
    if (cropperObj) cropperObj.setAspectRatio(1);
    document.querySelector('.cropper-view-box').style.borderRadius = '50%';
    document.querySelector('.cropper-face').style.borderRadius = '50%';
  } else if (shape === 'square') {
    document.getElementById('btnSquare').classList.add('active');
    if (cropperObj) cropperObj.setAspectRatio(1);
    document.querySelector('.cropper-view-box').style.borderRadius = '0';
    document.querySelector('.cropper-face').style.borderRadius = '0';
  } else {
    document.getElementById('btnFree').classList.add('active');
    if (cropperObj) cropperObj.setAspectRatio(NaN);
    document.querySelector('.cropper-view-box').style.borderRadius = '0';
    document.querySelector('.cropper-face').style.borderRadius = '0';
  }
}

function applyCrop() {
  if (!cropperObj) return;
  var canvas = cropperObj.getCroppedCanvas({ width: 300, height: 300, imageSmoothingQuality: 'high' });
  var base64 = canvas.toDataURL('image/png');
  var btn = document.querySelector('#cropperModal .btn-success');
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin me-1"></i>Saving...';
  $.ajax({
    url: "/api/profile",
    method: "POST",
    data: { action: "upload", image: base64 },
    success: function (result) {
      btn.disabled = false; btn.innerHTML = '<i class="fa fa-check me-1"></i>Apply & Save';
      if (result.success) {
        var newSrc = result.path + "?t=" + Date.now();
        $("#navProfilePic").attr("src", newSrc);
        closeCropperModal();
        alert("Profile picture updated!");
      } else {
        alert(result.message);
      }
    },
    error: function () {
      btn.disabled = false; btn.innerHTML = '<i class="fa fa-check me-1"></i>Apply & Save';
      alert("Server error!");
    }
  });
}

function removeProfilePic() {
  if (!confirm("Remove profile picture?")) return;
  $.ajax({
    url: "/api/profile",
    method: "POST",
    data: { action: "remove" },
    success: function (result) {
      if (result.success) {
        var defaultSrc = "https://ui-avatars.com/api/?name=" + encodeURIComponent(CURRENT_USER_NAME) + "&background=0d6efd&color=fff&size=64";
        $("#navProfilePic").attr("src", defaultSrc);
        $("#profileModalPic").attr("src", defaultSrc);
        closeProfileModal();
      } else {
        alert(result.message);
      }
    }
  });
}

function confirmLogout() {
  if (confirm("Are you sure you want to logout?")) {
    window.location.href = "/api/auth/logout";
  }
}

// ============================================================
// =================== AI FEATURES ===========================
// ============================================================

// ─── 1. AI INSIGHTS ─────────────────────────────────────────
var aiInsightsLoaded = false;

function loadAIInsights() {
  var box = document.getElementById("aiInsightsBox");
  var list = document.getElementById("aiInsightsList");
  if (!box || !list) return;
  box.style.display = "block";
  aiInsightsLoaded = false;
  list.innerHTML = '<div class="text-muted small"><i class="fa fa-spinner fa-spin me-2"></i>Analyzing your business data...</div>';

  apiPost("/api/ai/insights", {}, function (result) {
    if (result.success && result.insights && result.insights.length > 0) {
      var html = '<ul class="mb-0 ps-3">';
      result.insights.forEach(function (insight) {
        html += '<li class="small text-dark mb-1" style="line-height:1.5;">' + insight + '</li>';
      });
      html += '</ul>';
      list.innerHTML = html;
      aiInsightsLoaded = true;
    } else {
      list.innerHTML = '<div class="text-muted small"><i class="fa fa-info-circle me-1"></i>Add more invoices to get AI insights.</div>';
    }
  });
}

// ─── 2. CREATE INVOICE WITH AI ──────────────────────────────
var aiParsedData = null;

function openCreateWithAI() {
  document.getElementById("aiInvoiceModal").style.display = "flex";
  document.getElementById("aiParseStep1").classList.remove("d-none");
  document.getElementById("aiParseStep2").classList.add("d-none");
  document.getElementById("aiInvoiceText").value = "";
  document.getElementById("aiParseError").classList.add("d-none");
  document.getElementById("aiParseLoading").classList.add("d-none");
  aiParsedData = null;
}

function closeAIInvoiceModal() {
  document.getElementById("aiInvoiceModal").style.display = "none";
  aiParsedData = null;
}

function generateAIInvoice() {
  var text = document.getElementById("aiInvoiceText").value.trim();
  if (!text || text.length < 5) {
    showAIParseError("Please enter some invoice details first.");
    return;
  }
  document.getElementById("aiParseLoading").classList.remove("d-none");
  document.getElementById("aiParseError").classList.add("d-none");
  document.querySelector("#aiParseStep1 .btn-primary").disabled = true;

  apiPost("/api/ai/parse-invoice", { text: text }, function (result) {
    document.getElementById("aiParseLoading").classList.add("d-none");
    document.querySelector("#aiParseStep1 .btn-primary").disabled = false;

    if (!result.success) {
      showAIParseError(result.message || "AI could not parse the text. Try being more specific.");
      return;
    }

    if (!result.data || typeof result.data !== 'object') {
      showAIParseError("AI returned invalid data. Please try again.");
      return;
    }

    aiParsedData = result.data;

    // Show stock warnings
    var warnBox = document.getElementById("aiStockWarning");
    if (result.stockWarnings && result.stockWarnings.length > 0) {
      warnBox.innerHTML = "<strong>⚠️ Stock Warning:</strong><br>" + result.stockWarnings.join("<br>");
      warnBox.classList.remove("d-none");
    } else {
      warnBox.classList.add("d-none");
    }

    // Build preview
    var preview = "";
    if (result.data.customer_name) {
      preview += '<div class="mb-2"><strong>Customer:</strong> ' + (result.data.customer_name || "—") + '</div>';
    }
    preview += '<div class="mb-2"><strong>Date:</strong> ' + (result.data.issue_date || "—") + ' | <strong>Due:</strong> ' + (result.data.due_date || "—") + '</div>';
    if (result.data.items && result.data.items.length > 0) {
      preview += '<strong>Items:</strong><ul class="mt-1 mb-2 small">';
      result.data.items.forEach(function (item) {
        var warn = item.stock_warning ? ' <span class="text-danger">(⚠️ Only ' + item.stock_available + ' in stock)</span>' : '';
        preview += '<li>' + item.product_name + ' × ' + item.qty + ' @ ₹' + item.price + ' = ₹' + item.total + warn + '</li>';
      });
      preview += '</ul>';
    }
    preview += '<div><strong>Total: ₹' + parseFloat(result.data.total || 0).toLocaleString("en-IN") + '</strong></div>';
    if (result.data.notes) {
      preview += '<div class="text-muted small mt-1">Note: ' + result.data.notes + '</div>';
    }

    document.getElementById("aiParsedPreview").innerHTML = preview;
    document.getElementById("aiParseStep1").classList.add("d-none");
    document.getElementById("aiParseStep2").classList.remove("d-none");
  });
}

function showAIParseError(msg) {
  var errEl = document.getElementById("aiParseError");
  errEl.textContent = msg;
  errEl.classList.remove("d-none");
}

function aiParseBack() {
  document.getElementById("aiParseStep1").classList.remove("d-none");
  document.getElementById("aiParseStep2").classList.add("d-none");
}

function applyAIInvoice() {
  if (!aiParsedData) return;
  const data = aiParsedData;
  closeAIInvoiceModal();

  // Switch to Create Invoice page
  document.querySelectorAll(".page").forEach(function (p) { p.classList.add("d-none"); });
  document.getElementById("createInvoice").classList.remove("d-none");
  document.querySelectorAll(".menu-link").forEach(function (l) { l.classList.remove("active"); });
  document.querySelector('[data-page="createInvoice"]').classList.add("active");

  // Setup page first (loads customers/products dropdowns)
  setupCreateInvoicePage(function () {
    // Set customer
    if (data.customer_id) {
      var custSel = document.getElementById("invoiceCustomer");
      if (custSel) custSel.value = data.customer_id.toString();
    }

    // Set dates
    if (data.issue_date) {
      var dateEl = document.getElementById("invoiceDate");
      if (dateEl) dateEl.value = data.issue_date;
    }
    if (data.due_date) {
      var dueEl = document.getElementById("invoiceDueDate");
      if (dueEl) dueEl.value = data.due_date;
    }

    // Clear existing rows and add AI items
    var tbody = document.getElementById("invoiceItemsBody");
    if (tbody) tbody.innerHTML = "";
    invoiceRowCounter = 0;

    if (data.items && data.items.length > 0) {
      data.items.forEach(function (item) {
        addInvoiceRow();
        var rowId = "invRow" + invoiceRowCounter;
        var row = document.getElementById(rowId);
        if (!row) return;

        // Set product
        var sel = row.querySelector(".prod-select");
        if (sel && item.product_id) {
          sel.value = item.product_id.toString();
          if (sel.value !== item.product_id.toString()) {
            // Product not found in dropdown, set by name display
            sel.value = "";
          } else {
            onProductSelect(sel, rowId);
          }
        }

        // Override qty and price with AI values
        var qtyInput = row.querySelector(".qty-input");
        var priceInput = row.querySelector(".price-input");
        if (qtyInput) qtyInput.value = item.qty;
        if (priceInput) priceInput.value = item.price;
        calcRow(rowId);
      });
    } else {
      addInvoiceRow();
    }
  });
}

// ─── 3. AI PAYMENT REMINDER ─────────────────────────────────
var currentReminderInvoiceId = null;

function openAIReminder(invoiceId) {
  currentReminderInvoiceId = invoiceId;
  document.getElementById("aiReminderModal").style.display = "flex";
  document.getElementById("aiReminderLoading").classList.remove("d-none");
  document.getElementById("aiReminderContent").classList.add("d-none");
  document.getElementById("aiReminderError").classList.add("d-none");

  apiPost("/api/ai/reminder", { invoice_id: invoiceId }, function (result) {
    document.getElementById("aiReminderLoading").classList.add("d-none");
    if (result.success) {
      document.getElementById("aiReminderText").value = result.email;
      document.getElementById("aiReminderContent").classList.remove("d-none");
    } else {
      var errEl = document.getElementById("aiReminderError");
      errEl.textContent = result.message || "Failed to generate reminder.";
      errEl.classList.remove("d-none");
    }
  });
}

function closeAIReminderModal() {
  document.getElementById("aiReminderModal").style.display = "none";
  currentReminderInvoiceId = null;
}

function copyAIReminder() {
  var text = document.getElementById("aiReminderText").value;
  if (!text) return;
  navigator.clipboard.writeText(text).then(function () {
    var btn = document.querySelector("#aiReminderContent .btn-primary");
    var orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-check me-1"></i>Copied!';
    btn.classList.add("btn-success");
    btn.classList.remove("btn-primary");
    setTimeout(function () {
      btn.innerHTML = orig;
      btn.classList.remove("btn-success");
      btn.classList.add("btn-primary");
    }, 2000);
  }).catch(function () {
    // Fallback for older browsers
    var ta = document.getElementById("aiReminderText");
    ta.select();
    document.execCommand("copy");
    alert("Email copied to clipboard!");
  });
}

// Close modals on background click
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("modal-overlay")) {
    closeAIInvoiceModal();
    closeAIReminderModal();
  }
});
