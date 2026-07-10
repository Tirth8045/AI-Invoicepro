
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.json({ success: false, message: "Unauthorized" });
  }
  next();
}

module.exports = requireAuth;
