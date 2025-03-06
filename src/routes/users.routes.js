import { Router } from "express";
import { registerUser, logoutUser } from "../controllers/users.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";

import { verifyjwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

// secured route

router.route("/logout").post(verifyjwt, logoutUser);

export default router;
