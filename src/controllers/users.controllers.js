import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

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
      .json(new ApiResponse(200, createUser, "User registed succesfully"));
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
    secure: process.env.NODE_ENV === " production",
  };

  res
    .statusCode(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, loggedInUser, "User logged in successfully"));
});

export { registerUser, loginUser };
