import Documents from "../models/document.model.js";
import AppError from "../middlewares/error.middleware.js";
import fs from "fs";
import { CheckValidation } from "../utils/validation.util.js";
import Teams from "../models/team.model.js";
import Departments from "../models/department.model.js";
import mongoose from "mongoose";
import { getCompanyId } from "../utils/company.util.js";

/**
 * Check if two visibility arrays have overlapping departments
 * @param {Array} visibility1 - First visibility array
 * @param {Array} visibility2 - Second visibility array
 * @returns {boolean} - True if there's an overlap, false otherwise
 */
const hasVisibilityOverlap = (visibility1, visibility2) => {
  // Convert both arrays to sets of string representations for comparison
  const set1 = new Set(
    visibility1.map((v) =>
      v === "public" ? "public" : v.toString()
    )
  );
  const set2 = new Set(
    visibility2.map((v) =>
      v === "public" ? "public" : v.toString()
    )
  );

  // Check for overlap
  for (const item of set1) {
    if (set2.has(item)) {
      return true;
    }
  }
  return false;
};

/**
 * Compare two visibility arrays to check if they are equal
 * @param {Array} visibility1 - First visibility array
 * @param {Array} visibility2 - Second visibility array
 * @returns {boolean} - True if arrays are equal, false otherwise
 */
const areVisibilityArraysEqual = (visibility1, visibility2) => {
  if (visibility1.length !== visibility2.length) {
    return false;
  }

  const set1 = new Set(
    visibility1.map((v) =>
      v === "public" ? "public" : v.toString()
    )
  );
  const set2 = new Set(
    visibility2.map((v) =>
      v === "public" ? "public" : v.toString()
    )
  );

  if (set1.size !== set2.size) {
    return false;
  }

  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }

  return true;
};

/**
 * Check if a document with the same name already exists for the same department(s)
 * @param {ObjectId} companyId - Company ID
 * @param {String} documentName - Document name to check
 * @param {Array} visibility - Visibility array (departments or "public")
 * @param {ObjectId} excludeDocumentId - Optional document ID to exclude from check (for updates)
 * @returns {Promise<boolean>} - True if duplicate exists, false otherwise
 */
const checkDuplicateDocument = async (
  companyId,
  documentName,
  visibility,
  excludeDocumentId = null
) => {
  // Escape special regex characters in document name
  const escapedName = documentName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  // Find all documents with the same name (case-insensitive) in the same company
  const query = {
    company_id: companyId,
    document_name: { $regex: new RegExp(`^${escapedName}$`, "i") },
  };

  if (excludeDocumentId) {
    query._id = { $ne: excludeDocumentId };
  }

  const existingDocs = await Documents.find(query);

  if (existingDocs.length === 0) {
    return false; // No duplicates found
  }

  // Check if any existing document has overlapping visibility
  for (const existingDoc of existingDocs) {
    if (hasVisibilityOverlap(existingDoc.visibility, visibility)) {
      return true; // Duplicate found with overlapping departments
    }
  }

  return false; // No duplicates with overlapping departments
};

export const UploadDocumentService = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

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

  // Check for duplicate document with same name and overlapping departments
  const isDuplicate = await checkDuplicateDocument(
    companyId,
    document_name,
    finalVisibility
  );

  if (isDuplicate) {
    throw new AppError("Document already exists", 400);
  }

  const newDoc = await Documents.create({
    company_id: companyId,
    document_name,
    document_type,
    visibility: finalVisibility,
    file_url,
    uploaded_by: req.user._id,
  });

  return newDoc;
};

export const UpdateDocumentService = async (req, id, updateBody) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const doc = await Documents.findOne({ _id: id, company_id: companyId });
  if (!doc) throw new AppError("Document not found", 404);

  const newDocumentName = updateBody.document_name || doc.document_name;
  let newVisibility = doc.visibility;

  if (updateBody.visibility) {
    if (!Array.isArray(updateBody.visibility)) {
      throw new AppError("Visibility must be an array", 400);
    }
    newVisibility = updateBody.visibility.map((v) =>
      v === "public" ? "public" : new mongoose.Types.ObjectId(v)
    );
  }

  // Check for duplicate document with same name and overlapping departments
  // Only check if document name or visibility has changed
  if (
    newDocumentName !== doc.document_name ||
    !areVisibilityArraysEqual(newVisibility, doc.visibility)
  ) {
    const isDuplicate = await checkDuplicateDocument(
      companyId,
      newDocumentName,
      newVisibility,
      id // Exclude current document from duplicate check
    );

    if (isDuplicate) {
      throw new AppError("Document already exists", 400);
    }
  }

  doc.document_name = newDocumentName;
  doc.document_type = updateBody.document_type || doc.document_type;
  doc.visibility = newVisibility;

  await doc.save();
  return doc;
};

export const DeleteDocumentService = async (req, id) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const doc = await Documents.findOne({ _id: id, company_id: companyId });
  if (!doc) throw new AppError("Document not found", 404);

  try {
    fs.unlinkSync("." + doc.file_url);
  } catch (err) {
    console.warn("File deletion warning:", err.message);
  }

  await Documents.findOneAndDelete({ _id: id, company_id: companyId });
};

export const FetchDocumentsService = async (req, query) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const {
    visibility,
    document_type,
    month,
    search,
    page = 1,
    limit = 10,
  } = query;

  const filters = { company_id: companyId };

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
    const userTeam = await Teams.findOne({
      _id: user.team,
      company_id: companyId,
    });
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
        const depts = await Departments.find({
          company_id: companyId,
          _id: { $in: deptIds },
        }).select("name");
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
