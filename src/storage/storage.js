// FIXED STORAGE.JS
import multer from "multer";
import oci from "oci-sdk";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pemFilePath = path.resolve(__dirname, "oci_api_key.pem");

// OCI Configurations
const bucket_name = "WhiteBox";
const OCI_NAMESPACE = "bmtoavpciq1o";
const config = {
  user: "ocid1.user.oc1..aaaaaaaa33ia63zm2nlkc6mtow3imbenqbnd7wrx3lbhxidqi47fs5r52f3a",
  fingerprint: "2c:8c:3e:e8:44:9a:34:e0:26:5f:07:f5:c1:73:b5:48",
  tenancy:
    "ocid1.tenancy.oc1..aaaaaaaapxsjg235bvlblqzjgr6ukffefvt6dskbx55e4liy4pmtqajikkoa",
  region: "ap-mumbai-1",
  key_file: pemFilePath,
};

// Vercel/serverless: filesystem is read-only except /tmp
const isVercel = process.env.VERCEL === "1";
const configFilePath = isVercel
  ? path.resolve("/tmp", "oci_config")
  : path.resolve(__dirname, "oci_config");

const configContent = `
[DEFAULT]
user=${config.user}
fingerprint=${config.fingerprint}
key_file=${config.key_file}
tenancy=${config.tenancy}
region=${config.region}
`;
fs.writeFileSync(configFilePath, configContent);

// Initialize the Object Storage client
const provider = new oci.common.ConfigFileAuthenticationDetailsProvider(
  configFilePath
);
const client = new oci.objectstorage.ObjectStorageClient({
  authenticationDetailsProvider: provider,
});

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to handle single upload to OCI
const UploadSingleToOCI = () => async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const file = req.file;
  const objectName = Date.now() + "-" + file.originalname;

  const putObjectRequest = {
    namespaceName: OCI_NAMESPACE,
    bucketName: bucket_name,
    objectName: objectName,
    putObjectBody: file.buffer,
  };

  try {
    await client.putObject(putObjectRequest);
    const fileUrl = `https://objectstorage.${config.region}.oraclecloud.com/n/${OCI_NAMESPACE}/b/${bucket_name}/o/${objectName}`;
    res.status(200).json({ fileUrl: fileUrl });
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

// FIXED: Middleware to handle multiple upload to OCI
const UploadMultipleToOCI = () => async (req, res) => {
  console.log("Multiple upload handler called");
  console.log("Files received:", req.files?.length || 0);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  const fileUrls = [];
  let uploadIndex = 0;

  try {
    // Process each file sequentially
    for (const file of req.files) {
      console.log(`Processing file ${uploadIndex + 1}: ${file.originalname}`);

      // Create unique object name with timestamp + index + random string
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 9);
      const objectName = `${timestamp}-${uploadIndex}-${randomStr}-${file.originalname}`;

      const putObjectRequest = {
        namespaceName: OCI_NAMESPACE,
        bucketName: bucket_name,
        objectName: objectName,
        putObjectBody: file.buffer,
      };

      // Upload to OCI
      await client.putObject(putObjectRequest);

      // Generate file URL
      const fileUrl = `https://objectstorage.${config.region}.oraclecloud.com/n/${OCI_NAMESPACE}/b/${bucket_name}/o/${objectName}`;
      fileUrls.push(fileUrl);

      console.log(
        `File ${uploadIndex + 1} uploaded successfully: ${objectName}`
      );
      uploadIndex++;

      // Small delay to ensure unique timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    console.log(`All ${fileUrls.length} files uploaded successfully`);

    // Send response with all file URLs AFTER processing all files
    return res.status(200).json({
      fileUrls: fileUrls,
      message: `Successfully uploaded ${fileUrls.length} files`,
      totalFiles: fileUrls.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      error: error.message || error,
      filesUploaded: fileUrls.length,
      successfulUrls: fileUrls,
    });
  }
};

// Alternative parallel processing version (faster but uses more resources)
const UploadMultipleToOCIParallel = () => async (req, res) => {
  console.log("Parallel upload handler called");
  console.log("Files received:", req.files?.length || 0);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  try {
    // Process all files in parallel
    const uploadPromises = req.files.map(async (file, index) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 9);
      const objectName = `${timestamp}-${index}-${randomStr}-${file.originalname}`;

      const putObjectRequest = {
        namespaceName: OCI_NAMESPACE,
        bucketName: bucket_name,
        objectName: objectName,
        putObjectBody: file.buffer,
      };

      await client.putObject(putObjectRequest);
      return `https://objectstorage.${config.region}.oraclecloud.com/n/${OCI_NAMESPACE}/b/${bucket_name}/o/${objectName}`;
    });

    // Wait for all uploads to complete
    const fileUrls = await Promise.all(uploadPromises);

    console.log(
      `All ${fileUrls.length} files uploaded successfully (parallel)`
    );

    return res.status(200).json({
      fileUrls: fileUrls,
      message: `Successfully uploaded ${fileUrls.length} files`,
      totalFiles: fileUrls.length,
    });
  } catch (error) {
    console.error("Parallel upload error:", error);
    return res.status(500).json({
      error: error.message || error,
    });
  }
};

export {
  upload as UploadFile,
  UploadSingleToOCI as UploadSingleFile,
  UploadMultipleToOCI as UploadMultipleFiles,
  UploadMultipleToOCIParallel, // Export parallel version as well
};
