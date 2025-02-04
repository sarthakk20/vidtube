import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

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
  const avatarLoacalPath = req.files?.avatar[0]?.path;
  const coverImageLoacalPath = req.files?.coverImage[0]?.path;

  if (!avatarLoacalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  const avatar = await uploadToCloudinary(avatarLoacalPath);

  let coverImage = "";
  if (coverImageLoacalPath) {
    const coverImage = await uploadToCloudinary(coverImageLoacalPath);
  }
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
});
export { registerUser };
