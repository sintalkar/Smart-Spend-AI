import jwt from 'jsonwebtoken';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized, token missing", errors: [] });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwtsecretkey');
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized, invalid token", errors: [] });
  }
};

export { protect };
