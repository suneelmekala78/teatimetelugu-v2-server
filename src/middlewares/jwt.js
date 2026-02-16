import bcrypt from "bcryptjs";
import JWT from "jsonwebtoken";
import crypto from "crypto";

export const userAuth = (req, res, next) => {
  const token = req?.cookies?.accessToken;

  if (!token) {
    return res.status(401).send({
      status: "fail",
      message: "No token provided!",
      tokenExpired: true, 
    }); 
  }

  try {
    const decoded = JWT.verify(token, process.env.JWT_ACCESS_SECRET_KEY);
    req.user = { user: decoded.user };
    next();
  } catch (err) {
    console.error(err);
    return res.status(403).send({
      status: "fail",
      message: "Invalid or expired token!",
      tokenExpired: err.name === "TokenExpiredError", // indicates refresh token flow should be triggered
    });
  }
};

export const hashString = async (useValue) => {
  const salt = await bcrypt.genSalt(10);
  const hashedpassword = await bcrypt.hash(useValue, salt);
  return hashedpassword;
};

export const compareString = async (password, userPassword) => {
  const isMatch = await bcrypt.compare(password, userPassword);
  return isMatch;
};

export function createJWT(user) {
  return JWT.sign(
    { user, jti: crypto.randomUUID() },
    process.env.JWT_ACCESS_SECRET_KEY,
    {
      expiresIn: "15m",
      issuer: "Tea Time Telugu",
      audience: process.env.CLIENT_URLS,
    }
  );
}

export function createRefreshJWT(user) {
  return JWT.sign(
    { user, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET_KEY,
    {
      expiresIn: "7d",
      issuer: "Tea Time Telugu",
      audience: process.env.CLIENT_URLS,
    }
  );
}

export function verifyRefreshJWT(token) {
  return JWT.verify(token, process.env.JWT_REFRESH_SECRET_KEY);
}
