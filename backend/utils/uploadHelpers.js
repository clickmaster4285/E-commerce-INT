  const path = require("path");
  const fs = require("fs-extra");
const log = require("./logger");
const { UPLOAD_ROOT, uploadDirFor, localPathForUrl, maybeRemoveFromObjectStorage } = require("./uploadPaths");

  // Single image delete (local + S3 when live)
  const deleteImageFile = async (imgUrl) => {
    try {
      if (!imgUrl) return;

      // Sirf isi store ki (ya purani shared) file — dusre store ka path / ../ → null
      const filePath = localPathForUrl(null, imgUrl);

      if (filePath && (await fs.pathExists(filePath))) {
        await fs.remove(filePath);
      }
      await maybeRemoveFromObjectStorage(imgUrl);
    } catch (error) {
      log.error(
        "Image delete error:",
        error.message
      );
    }
  };


  // Complete product upload folder delete
  const deleteProductUploadFolder = async (productId) => {
    try {
      if (!productId) return;

      // Naya: uploads/stores/<storeId>/products/<id> · purana: uploads/products/<id>
      const folders = [
        uploadDirFor(null, "products", productId.toString()),
        path.join(UPLOAD_ROOT, "products", productId.toString()),
      ];

      for (const folderPath of folders) {
        if (await fs.pathExists(folderPath)) {
          await fs.remove(folderPath);
        }
      }
    } catch (error) {
      log.error(
        "Product upload folder delete error:",
        error.message
      );
    }
  };


  module.exports = {
    deleteImageFile,
    deleteProductUploadFolder,
  };