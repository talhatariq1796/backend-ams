import mongoose from "mongoose";

export const DBConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(process.env.MONGODB_URI);
    console.log("Database Sccessfully Connected");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
};
