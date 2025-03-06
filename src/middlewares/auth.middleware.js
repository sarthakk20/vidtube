import jwt from "jsonwebtoken";
import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asynchandler";

export const verifyjwt = asyncHandler(async (req, _ , next) => {
    const token = req.cookies.accessToken || req.header("Authorization")?.replace("Bearer " , "");

    if(!token){
        throw new ApiError(401, "Unauthorized");
    };
    try {
        const decodedToken = verifyjwt(token, process.env.ACCESS_TOKEN_SECRET)

        const user = User.findById(decodedToken?._id).select("-password -refreshToken");
        if(!user){
            throw new ApiError(401, "Unauthorized");
        }
        req.user = user;

        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
})