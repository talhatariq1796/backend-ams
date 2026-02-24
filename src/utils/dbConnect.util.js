import mongoose from "mongoose";

export const DBConnect = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      // Already connected
      return mongoose.connection;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Database Successfully Connected");
    return mongoose.connection;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
};
