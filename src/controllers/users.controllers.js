import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import e from "express";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    // small check for user existence
    if (!user) {
      throw new ApiError(500, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating acces and refresh tokens..."
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // todo
  const { fullname, username, email, password } = req.body;

  //validation

  // all fields are required for user to enter
  if (
    [fullname, username, email, password].some(
      (fields) => fields?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // find user into the DB, based on either username or email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  //if the user already exist in the DB, throw error
  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists.");
  }

  // image handling
  const avatarLoacalPath = req.files?.avatar?.[0]?.path;
  const coverImageLoacalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLoacalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  // const avatar = await uploadToCloudinary(avatarLoacalPath);

  // let coverImage = "";
  // if (coverImageLoacalPath) {
  //   const coverImage = await uploadToCloudinary(coverImageLoacalPath);
  // }

  let avatar;
  try {
    avatar = await uploadToCloudinary(avatarLoacalPath);
    console.log("Uploaded avatar", avatar);
  } catch (error) {
    console.log("Error uploading avatar", error);
    throw new ApiError(500, "Failed to upload avatar file");
  }

  let coverImage;
  try {
    coverImage = await uploadToCloudinary(coverImageLoacalPath);
    console.log("Uploaded coverImage", coverImage);
  } catch (error) {
    console.log("Error uploading coverImage", error);
    throw new ApiError(500, "Failed to upload cover image file");
  }

  try {
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });
    const createUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createUser) {
      throw new ApiError(500, "Something went wrong while registering user");
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createUser, "User registered succesfully"));
  } catch (error) {
    console.log("User creation failed");
    if (avatar) {
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage) {
      await deleteFromCloudinary(coverImage.public_id);
    }
    throw new ApiError(
      500,
      "Something went wrong while registering user and images were deleted from cloudinary"
    );
  }
});

const loginUser = asyncHandler(async (req, res) => {
  // get data from the body
  const { email, username, password } = req.body;

  // validate
  if ([email, username, password].some((fields) => fields?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // find user into the DB, based on either username or email
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // validate password
  const isPasswordValid = await isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!loggedInUser) {
    throw new ApiError(403, "Error while logging in");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  res
    .statusCode(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, loggedInUser, "User logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id, 
    { 
      $set:{ 
        refreshToken: "" 
      }
    },
    {new : true}
    );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  res
    .statusCode(200)
    .clearcookie("accessToken", accessToken, options)
    .clearcookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refressh Token is Required");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    if(incomingRefreshToken !== user.refreshToken){
      throw new ApiError(401, "Invalid Refresh Token");
    }

    const options={
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    }

    const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id);

    res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse
      (200, 
        {accessToken, 
        refreshToken: newRefreshToken},
        "Access Token refreshed successfully"
        ));

  } catch (error) {
    throw new ApiError(500, "Something went wrong while refreshing token");
  }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {

  const {oldPassword, newPassword} = req.body;
  
  const user = await User.findById(req.user?._id);

  const isPasswordValid = await User.isPasswordCorrect(oldPassword);

  if(!isPasswordValid){
    throw new ApiError(401, "Invalid Credentials");
  }

  user.password = newPassword;

  await user.save({validateBeforeSave: false});

  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));

})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"));
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const {fullname,email} = req.body;
   
  if(!fullname || !email){
    throw new ApiError(400, "Fullname and email are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullname,
        email:email
      }
    },
    {new: true}).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));

})

const updateUserAvatar = asyncHandler(async (req, res) => {

  const avatarLoacalPath = req.file?.path;

  if(!avatarLoacalPath){
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadToCloudinary(avatarLoacalPath);

  if(!avatar.url){
    throw new ApiError(500, "Failed to upload avatar file");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url
      }
    },
    {new: true}).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));

})

const updateUserCoverImage = asyncHandler(async (req, res) => {

  const coverImageLoacalPath = req.file?.path;

  if(!coverImageLoacalPath){
    throw new ApiError(400, "Avatar file is missing");
  }

  const coverImage = await uploadToCloudinary(coverImageLoacalPath);

  if(!coverImage.url){
    throw new ApiError(500, "Failed to upload cover image file");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage: coverImage.url
      }
    },
    {new: true}).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const {username} = req.params;

  if(!username.trim()){
    throw new ApiError(400, "Username is required");
  }

  const channel = await User.aggregate([

    {
      $match:{
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscriber"           //peope who subscribed to me         
      }
    },
    {
      $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"             //my subscribtion list
      }
    },
    {
      $addFields:{
        subscriberCount: {$size: "$subscriber"},
        subscribedToCount: {$size: "$subscribedTo"},
        issubscribe:{ $cond:{
          if:{$in: [req.user?._id, "$subscriber.subscriber"]},
          then: true,
          else: false
              }
        }
      },
    },
    {
      $project:{
        username: 1,
        fullname: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        subscribedToCount: 1,
        issubscribe: 1,
        
    }
    }
  ]);

  if(!channel?.length){
    throw new ApiError(404, "Channel not found");
  }

  console.log(channel);
  
  return res
  .status(200)
  .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"));

})

const getWatchHistory = asyncHandler(async (req, res) => {

  const user = await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.ObjectId(req.user?._id)
      }
    },
    {
      $lookup:{
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline:
        [
          {
            $lookup:{
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline:[
                {
                  $project:{
                    username: 1,
                    fullname: 1,
                    avatar: 1
                  }
                } 
              ]
            }
          },
          {
            $addFields:{
              $first: '$owner' 
            }
          }
          ]
      }
    },
    {
      $project:{
        _id: 0,
        watchHistory: 1
      }
    }
  ]);

return res
.status(200)
.json(new ApiResponse(200, user[0]?.watchHistory, "Watch History fetched successfully"));
})

export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails, 
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
    };
