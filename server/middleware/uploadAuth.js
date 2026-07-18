const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../routes/auth');

// Accept JWT from Authorization header (API calls) or ?token= query param
// (needed for <img src> tags, which cannot send custom headers).
function requireUploadAuth(req, res, next) {
  const headerToken = req.headers['authorization']?.split(' ')[1];
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

module.exports = requireUploadAuth;
