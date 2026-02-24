import * as DocumentService from "../services/document.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";

export const UploadDocument = async (req, res) => {
  try {
    const data = await DocumentService.UploadDocumentService(req);
    AppResponse({
      res,
      statusCode: 201,
      message: "Document uploaded successfully.",
      data,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      req.params.id,
      req.body
    );
    AppResponse({
      res,
      statusCode: 200,
      message: "Document updated successfully.",
      data,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const DeleteDocument = async (req, res) => {
  try {
    await DocumentService.DeleteDocumentService(req.params.id);
    AppResponse({
      res,
      statusCode: 200,
      message: "Document deleted successfully",
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const FetchDocuments = async (req, res) => {
  try {
    const data = await DocumentService.FetchDocumentsService(
      req.user,
      req.query
    );
    AppResponse({
      res,
      statusCode: 200,
      message: "Documents fetched successfully",
      data,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Document types retrieved successfully",
      data: types,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Document visibilities retrieved successfully",
      data: visibilities,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
