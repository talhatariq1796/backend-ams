import mongoose from "mongoose";

const DocumentSchema = mongoose.Schema(
  {
    document_name: {
      type: String,
      required: true,
      trim: true,
    },
    document_type: {
      type: String,
      enum: [
        "all documents",
        "remote work guidelines",
        "attendance & punctuality policy",
        "employee handbook",
        "payroll & compensation policy",
        "other",
      ],
      required: true,
    },
    visibility: {
      type: [mongoose.Schema.Types.Mixed], // array of "public" or ObjectIds
      required: true,
      validate: {
        validator: function (vals) {
          if (!Array.isArray(vals) || vals.length === 0) return false;

          return vals.every(
            (val) =>
              val === "public" ||
              mongoose.Types.ObjectId.isValid(val.toString())
          );
        },
        message:
          "Visibility must be an array containing 'public' or valid ObjectIds",
      },
    },

    file_url: {
      type: String,
      required: true,
    },
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Documents", DocumentSchema);
