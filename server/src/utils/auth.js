const jwt = require('jsonwebtoken');

function generateAuthToken(user, secret, expiresIn) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role || null,
    },
    secret,
    { expiresIn }
  );
}

function readBearerToken(authHeader = '') {
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

function verifyAuthToken(token, secret) {
  return jwt.verify(token, secret);
}

module.exports = {
  generateAuthToken,
  readBearerToken,
  verifyAuthToken,
};
