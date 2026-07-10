// ===== OPEN / CLOSE MODALS =====
function openLogin() {
  document.getElementById("loginBox").style.display = "flex";
}

function openSignup() {
  document.getElementById("signupBox").style.display = "flex";
}

function closeAuth() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("signupBox").style.display = "none";
}

function switchToSignup() {
  closeAuth();
  openSignup();
}

function switchToLogin() {
  closeAuth();
  openLogin();
}

// ===== CHECK REMEMBERED EMAIL =====
window.addEventListener("DOMContentLoaded", function () {
  // Read remember_email cookie and pre-fill login field
  var cookies = document.cookie.split(";");
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i].trim();
    if (c.startsWith("remember_email=")) {
      var email = c.substring("remember_email=".length);
      var loginField = document.getElementById("loginUser");
      if (loginField) loginField.value = decodeURIComponent(email);
    }
  }

  // If already logged in (valid session), skip straight to dashboard
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        window.location.href = "dashboard.html";
      }
    })
    .catch(function () {});
});

// ===== LOGIN =====
function doLogin(e) {
  e.preventDefault();

  var user = document.getElementById("loginUser").value.trim();
  var pass = document.getElementById("loginPass").value.trim();

  // Client side validation
  if (!user || !pass) {
    alert("Please fill all fields!");
    return;
  }

  var emailPattern  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var mobilePattern = /^[0-9]{10}$/;

  if (!emailPattern.test(user) && !mobilePattern.test(user)) {
    alert("Enter a valid Email or 10-digit Mobile number!");
    return;
  }

  if (pass.length < 4) {
    alert("Password must be at least 4 characters!");
    return;
  }

  // Check remember me
  var rememberMe = document.getElementById("rememberMe");
  var remember   = (rememberMe && rememberMe.checked) ? "yes" : "no";

  // Send to Node/Express API
  var formData = new FormData();
  formData.append("action",   "login");
  formData.append("user",     user);
  formData.append("password", pass);
  formData.append("remember", remember);

  var btn = document.querySelector("#loginForm button[type='submit']");
  btn.disabled    = true;
  btn.textContent = "Logging in...";

  fetch("/api/auth/login", {
    method: "POST",
    body: formData,
    credentials: "same-origin"
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      // Save name in localStorage for display
      localStorage.setItem("userName", data.name);
      // Redirect to dashboard
      window.location.href = data.redirect;
    } else {
      alert(data.message);
      btn.disabled    = false;
      btn.textContent = "Login";
    }
  })
  .catch(function(err) {
    alert("Something went wrong. Make sure the backend server is running!");
    btn.disabled    = false;
    btn.textContent = "Login";
  });
}

// ===== SIGNUP =====
function doSignup(e) {
  if (e) e.preventDefault();

  var name   = document.getElementById("signupName").value.trim();
  var mobile = document.getElementById("signupMobile").value.trim();
  var email  = document.getElementById("signupUser").value.trim();
  var pass   = document.getElementById("signupPass").value.trim();

  // Client side validation
  if (!name || !mobile || !email || !pass) {
    alert("Please fill all fields!");
    return;
  }

  var mobilePattern = /^[0-9]{10}$/;
  if (!mobilePattern.test(mobile)) {
    alert("Enter a valid 10-digit mobile number!");
    return;
  }

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    alert("Enter a valid email address!");
    return;
  }

  if (pass.length < 4) {
    alert("Password must be at least 4 characters!");
    return;
  }

  // Send to Node/Express API
  var formData = new FormData();
  formData.append("action",   "signup");
  formData.append("name",     name);
  formData.append("mobile",   mobile);
  formData.append("email",    email);
  formData.append("password", pass);

  var btn = document.querySelector("#signupForm button[type='submit']");
  btn.disabled    = true;
  btn.textContent = "Signing up...";

  fetch("/api/auth/signup", {
    method: "POST",
    body: formData,
    credentials: "same-origin"
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      alert(data.message);
      closeAuth();
      openLogin();
    } else {
      alert(data.message);
    }
    btn.disabled    = false;
    btn.textContent = "Sign Up";
  })
  .catch(function(err) {
    alert("Something went wrong. Make sure the backend server is running!");
    btn.disabled    = false;
    btn.textContent = "Sign Up";
  });
}
