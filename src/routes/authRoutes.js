import { Router } from "express";
import {
  googleCallback,
  joinWithGoogle,
  login,
  logout,
  refreshToken,
  register,
} from "../controllers/authController.js";

const router = Router();

router.get("/join-with-google", joinWithGoogle);
router.get("/google/callback", googleCallback);

router.post("/register", register);
router.post("/refresh-token", refreshToken);
router.post("/login", login);
router.post("/logout", logout);

export default router;
