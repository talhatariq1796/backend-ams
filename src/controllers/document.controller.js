import * as DocumentService from "../services/document.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";

export const UploadDocument = async (req, res) => {
  try {
    const data = await DocumentService.UploadDocumentService(req);
    return AppResponse({
      res,
      statusCode: 201,
      message: "Document uploaded successfully.",
      data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const UpdateDocument = async (req, res) => {
  try {
    const data = await DocumentService.UpdateDocumentService(
      req,
      req.params.id,
      req.body
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Document updated successfully.",
      data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const DeleteDocument = async (req, res) => {
  try {
    await DocumentService.DeleteDocumentService(req, req.params.id);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Document deleted successfully",
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const FetchDocuments = async (req, res) => {
  try {
    const data = await DocumentService.FetchDocumentsService(req, req.query);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Documents fetched successfully",
      data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetDocumentTypes = async (req, res) => {
  try {
    const types = await DocumentService.GetDocumentTypesService();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Document types retrieved successfully",
      data: types,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetDocumentVisibilities = async (req, res) => {
  try {
    const visibilities = await DocumentService.GetDocumentVisibilitiesService();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Document visibilities retrieved successfully",
      data: visibilities,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
