const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");

const path = require("path");

// ============================================
// KONFIGURASI S3
// ============================================

const client = new S3Client({
  region: "sgp1",

  endpoint: process.env.endpoint,

  credentials: {
    accessKeyId: process.env.access_key_id,
    secretAccessKey: process.env.secret_access_key
  },

  forcePathStyle: true
});

const bucketName =
  process.env.bucket_name?.trim();

if (!bucketName) {
  throw new Error(
    "Konfigurasi bucket_name belum terbaca"
  );
}


// ============================================
// MIME TYPE
// Padanan Ruby: mime_for
// ============================================

function mimeFor(filename) {

  const ext =
    path.extname(
      String(filename || "")
    ).toLowerCase();

  switch (ext) {

    case ".pdf":
      return "application/pdf";

    case ".jpg":
    case ".jpeg":
      return "image/jpeg";

    case ".png":
      return "image/png";

    case ".gif":
      return "image/gif";

    case ".doc":
      return "application/msword";

    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    case ".xls":
      return "application/vnd.ms-excel";

    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    default:
      return "application/octet-stream";

  }

}


// ============================================
// CONTENT DISPOSITION
// Padanan Ruby: disposition_for
// ============================================

function dispositionFor(
  mime,
  filename,
  download = false
) {

  const basename =
    path.basename(
      String(filename || "dokumen")
    );

  const safeName =
    basename
      .replace(/[\r\n"]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_");

  const encodedName =
    encodeURIComponent(basename);

  const isPreviewable =
    mime.startsWith("image/") ||
    mime === "application/pdf";

  const disposition =
    download || !isPreviewable
      ? "attachment"
      : "inline";

  return (
    `${disposition}; ` +
    `filename="${safeName}"; ` +
    `filename*=UTF-8''${encodedName}`
  );

}


// ============================================
// UPLOAD FILE
// Padanan Ruby: upload_file
// ============================================

async function uploadFile(file, nameFile) {

  const command = new PutObjectCommand({

    Bucket: bucketName,

    Key: nameFile,

    Body: file.buffer,

    ContentType:
      file.mimetype || "application/octet-stream"

  });

  const result = await client.send(command);

  return {
    success: true,
    key: nameFile,
    etag: result.ETag || null
  };

}

// ======================================================
// GET FILE LINK
// ======================================================

async function getFileLink(
  nameFile,
  options = {}
) {

  const {
    download = false,
    isPrivate = true,
    originalName = null
  } = options;

  if (!nameFile) {
    throw new Error(
      "Nama file wajib diisi"
    );
  }

  // ================================================
  // BUCKET PRIVATE
  // ================================================

  if (isPrivate) {

    return getImageLinkPresigned(
      nameFile,
      {
        download,
        originalName
      }
    );

  }

  // ================================================
  // BUCKET PUBLIC
  // ================================================

  const endpointFile =
    process.env.endpoint_file?.trim();

  if (!endpointFile) {
    throw new Error(
      "endpoint_file belum dikonfigurasi"
    );
  }

  const baseUrl =
    endpointFile.replace(/\/+$/, "");

  const fileKey =
    String(nameFile)
      .replace(/^\/+/, "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");

  return `${baseUrl}/${fileKey}`;

}
// ============================================
// PRESIGNED URL
// Padanan Ruby: get_image_link_presigned
// ============================================

async function getImageLinkPresigned(
  nameFile,
  options = {}
) {

  const {
    download = false,
    originalName = null
  } = options;

  if (!nameFile) {

    throw new Error(
      "Nama file wajib diisi"
    );

  }

  const filename =
    originalName ||
    path.basename(nameFile);

  const mime =
    mimeFor(filename);

  const disposition =
    dispositionFor(
      mime,
      filename,
      download
    );

  const command =
    new GetObjectCommand({

      Bucket: bucketName,

      Key: nameFile,

      ResponseContentType:
        mime,

      ResponseContentDisposition:
        disposition

    });

  try {

    const url =
      await getSignedUrl(
        client,
        command,
        {
          expiresIn: Number(
        process.env.time_exp || 300
        )
        }
      );

    return url;

  } catch (error) {

    console.error(
      "ERROR PRESIGNED URL:",
      error
    );

    throw error;

  }

}


// ============================================
// GET IMAGE LINK
// Padanan Ruby: get_image_link
// ============================================

async function getImageLink(
  idPr,
  nameFile,
  options = {}
) {

  return getImageLinkPresigned(
    nameFile,
    options
  );

}


// ============================================
// EXPORT
// ============================================

module.exports = {
  client,
  uploadFile,
  getImageLinkPresigned,
  getImageLink,
  getFileLink,
  mimeFor,
  dispositionFor
};