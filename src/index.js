import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
  path: "./.env",
});

const PORT = process.env.PORT || 8000;

connectDB()
  .then(
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}...`);
    })
  )
  .catch((err) => {
    if (err.code === "EACCES") {
      console.error(`Port ${PORT} requires elevated privileges`);
    } else if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error(`Error occurred: ${err}`);
    }
  });
