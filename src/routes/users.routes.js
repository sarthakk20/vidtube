import { Router } from "express";
import { registerUser, logoutUser, loginUser, refreshAccessToken, getUserChannelProfile } from "../controllers/users.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";

import { verifyjwt } from "../middlewares/auth.middleware.js";

const router = Router();

// unsecured routes

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

router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

// secured route

router.route("/logout").post(verifyjwt, logoutUser);
router.route("/change-Password").post(verifyjwt, changeCurrentPassword);
router.route("/get-User").get(verifyjwt, getCurrentUser);
router.route("/c/:username").get(verifyjwt, getUserChannelProfile);
router.route("/update-account").patch(verifyjwt, updateAccountDetails);

router.route("/avatar").patch(verifyjwt, upload.single("avatar"), updateUserAvatar);
router.route("/cover-image").patch(verifyjwt, upload.single("converImage"), updateUserAvatar);
router.route("/history").get(verifyjwt, getUserHistory);


export default router;
