import Documents from "../models/document.model.js";
import AppError from "../middlewares/error.middleware.js";
import fs from "fs";
import { CheckValidation } from "../utils/validation.util.js";
import Teams from "../models/team.model.js";
import Departments from "../models/department.model.js";
import mongoose from "mongoose";

export const UploadDocumentService = async (req) => {
  const { document_name, document_type, visibility, file_url } = req.body;

  const validationError = CheckValidation(
    ["document_name", "document_type", "visibility", "file_url"],
    { body: req.body }
  );
  if (validationError) {
    throw new AppError(validationError, 400);
  }

  let finalVisibility = [];

  if (Array.isArray(visibility)) {
    visibility.forEach((v) => {
      if (v === "public") {
        finalVisibility.push("public");
      } else if (mongoose.Types.ObjectId.isValid(v)) {
        finalVisibility.push(new mongoose.Types.ObjectId(v));
      } else {
        throw new AppError(
          "Visibility must be 'public' or a valid department ID",
          400
        );
      }
    });
  } else {
    throw new AppError("Visibility must be an array", 400);
  }

  const newDoc = await Documents.create({
    document_name,
    document_type,
    visibility: finalVisibility,
    file_url,
    uploaded_by: req.user._id,
  });

  return newDoc;
};

export const UpdateDocumentService = async (id, updateBody) => {
  const doc = await Documents.findById(id);
  if (!doc) throw new AppError("Document not found", 404);

  doc.document_name = updateBody.document_name || doc.document_name;
  doc.document_type = updateBody.document_type || doc.document_type;

  if (updateBody.visibility) {
    if (!Array.isArray(updateBody.visibility)) {
      throw new AppError("Visibility must be an array", 400);
    }
    doc.visibility = updateBody.visibility.map((v) =>
      v === "public" ? "public" : new mongoose.Types.ObjectId(v)
    );
  }

  await doc.save();
  return doc;
};

export const DeleteDocumentService = async (id) => {
  const doc = await Documents.findById(id);
  if (!doc) throw new AppError("Document not found", 404);

  try {
    fs.unlinkSync("." + doc.file_url);
  } catch (err) {
    console.warn("File deletion warning:", err.message);
  }

  await Documents.findByIdAndDelete(id);
};

export const FetchDocumentsService = async (user, query) => {
  const {
    visibility,
    document_type,
    month,
    search,
    page = 1,
    limit = 10,
  } = query;

  const filters = {};

  if (document_type && document_type !== "all documents") {
    filters.document_type = document_type;
  }

  if (month) {
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    filters.updatedAt = { $gte: startDate, $lt: endDate };
  }

  if (search) {
    filters.document_name = { $regex: search, $options: "i" };
  }

  if (user.role === "admin") {
    if (visibility) {
      if (visibility === "public") {
        filters.visibility = "public";
      } else if (mongoose.Types.ObjectId.isValid(visibility)) {
        filters.visibility = new mongoose.Types.ObjectId(visibility);
      } else {
        throw new AppError("Invalid visibility format", 400);
      }
    }
  } else {
    const userTeam = await Teams.findById(user.team);
    if (!userTeam) throw new AppError("User team not found", 404);

    const departmentId = userTeam.department?.toString();
    if (!departmentId) throw new AppError("Department not found", 404);

    filters.visibility = {
      $in: ["public", new mongoose.Types.ObjectId(departmentId)],
    };
  }

  const rawDocs = await Documents.find(filters)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const enrichedDocs = await Promise.all(
    rawDocs.map(async (doc) => {
      let departmentNames = [];

      if (doc.visibility.includes("public")) {
        departmentNames.push("public");
      }

      const deptIds = doc.visibility.filter((v) => v !== "public");
      if (deptIds.length > 0) {
        const depts = await Departments.find({ _id: { $in: deptIds } }).select(
          "name"
        );
        departmentNames.push(...depts.map((d) => d.name));
      }

      return {
        ...doc.toObject(),
        departments: departmentNames,
      };
    })
  );

  const count = await Documents.countDocuments(filters);

  return {
    documents: enrichedDocs,
    totalDocuments: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
  };
};

export const GetDocumentTypesService = async () => {
  try {
    const types = Documents.schema.path("document_type").enumValues;
    return {
      types,
      count: types.length,
    };
  } catch (error) {
    throw new AppError("Failed to fetch document types", 500);
  }
};

export const GetDocumentVisibilitiesService = async () => {
  try {
    const visibilities = Documents.schema.path("visibility").enumValues;
    return {
      visibilities,
      count: visibilities.length,
    };
  } catch (error) {
    throw new AppError("Failed to fetch document visibilities", 500);
  }
};
