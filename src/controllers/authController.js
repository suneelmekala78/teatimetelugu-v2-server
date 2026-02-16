import JWT from "jsonwebtoken";
import passport from "passport";
import {
  compareString,
  createJWT,
  createRefreshJWT,
  hashString,
} from "../middlewares/jwt.js";
import Users from "../models/userModel.js";

/**
 * Register a new user
 */
export const register = async (req, res) => {
  const { fullName, email, password, role = "user" } = req.body;

  try {
    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Full name, email, and password are required!",
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: "fail",
        message: "Password must be at least 6 characters long",
      });
    }

    const userExist = await Users.findOne({ email: email.toLowerCase() });
    if (userExist) {
      return res.status(409).json({
        status: "fail",
        message: "User already exists with this email. Please login!",
      });
    }

    const hashedPassword = await hashString(password);

    const user = await Users.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      role,
      password: hashedPassword,
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    res.status(201).json({
      status: "success",
      message: "Registered successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: "fail",
        message: "User with these details already exists",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        status: "fail",
        message: "Validation failed",
        errors,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Email and password are required.",
      });
    }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a valid email address.",
      });
    }

    const user = await Users.findOne({ email: trimmedEmail.toLowerCase() })
      .select("+password")
      .select("+refreshToken");

    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: "fail",
        message: "Account is deactivated. Please contact support.",
      });
    }

    const isMatch = await compareString(trimmedPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid email or password.",
      });
    }

    const tokenUser = {
      _id: user._id,
      fullName: user.fullName,
      profileUrl: user.profileUrl,
      email: user.email,
      role: user.role,
    };

    const accessToken = createJWT(tokenUser);
    const refreshToken = createRefreshJWT(tokenUser);

    user.refreshToken = refreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      status: "success",
      message: "Login successful",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        profileUrl: user.profileUrl,
        role: user.role,
        lang: user.lang,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

/**
 * Logout user
 */
export const logout = async (req, res) => {
  const { refreshToken } = req.cookies;

  const isProduction = process.env.NODE_ENV === "production";

  if (refreshToken) {
    await Users.updateOne({ refreshToken }, { $unset: { refreshToken: 1 } });
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
  });

  return res.status(200).send({
    status: "success",
    message: "Logged out successfully",
  });
};

/**
 * Refresh token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        status: "fail",
        message: "No refresh token provided!",
        tokenExpired: true,
      });
    }

    const user = await Users.findOne({ refreshToken });
    if (!user) {
      const isProduction = process.env.NODE_ENV === "production";
      // Clear cookies if refresh token is invalid
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
      });

      return res.status(403).json({
        status: "fail",
        message: "Invalid refresh token! Login again.",
        tokenExpired: true,
      });
    }

    let decoded;
    try {
      decoded = JWT.verify(refreshToken, process.env.JWT_REFRESH_SECRET_KEY);
    } catch (err) {
      // Clear invalid refresh token from database
      await Users.findByIdAndUpdate(user._id, { $unset: { refreshToken: 1 } });
      return res.status(403).json({
        status: "fail",
        message: "Refresh token expired or invalid!",
        tokenExpired: true,
      });
    }

    const tokenUser = {
      _id: user._id,
      fullName: user.fullName,
      profileUrl: user.profileUrl,
      email: user.email,
      role: user.role,
    };

    // Rotate tokens
    const newAccessToken = createJWT(tokenUser);
    const newRefreshToken = createRefreshJWT(tokenUser);

    // Save new refreshToken
    user.refreshToken = newRefreshToken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: "success",
      message: "Tokens refreshed successfully",
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

/**
 * Google Auth handlers
 */
export const joinWithGoogle = (req, res) => {
  const client = req.query.client;

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: client,
  })(req, res);
};

export const googleCallback = (req, res) => {
  passport.authenticate(
    "google",
    { session: false, failureRedirect: "/" },
    async (err, data) => {
      if (err || !data) {
        console.error("Google authentication error:", err);
        return res
          .status(404)
          .json({ status: "fail", message: "Authentication failed!" });
      }

      const { user, token: accessToken, refreshToken } = data;
      const client = req.query.state;

      // const accessToken = createJWT(user);
      // const refreshToken = createRefreshJWT(user);
      await Users.findByIdAndUpdate(user._id, { refreshToken });

      const isProduction = process.env.NODE_ENV === "production";

      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // HTTPS only in production
        sameSite: isProduction ? "None" : "Lax",
        domain: isProduction ? ".teatimetelugu.com" : "localhost", // 🔥 important
        path: "/", // always include
      };

      /* access token */
      res.cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      /* refresh token */
      res.cookie("refreshToken", refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.redirect(`${client}`);
    },
  )(req, res);
};
