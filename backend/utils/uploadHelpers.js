  const path = require("path");
  const fs = require("fs-extra");
const log = require("./logger");

  // Single image delete
  const deleteImageFile = async (imgUrl) => {
    try {
      if (!imgUrl) return;

      const cleanPath = imgUrl.replace(/^\/+/, "");

      const filePath = path.join(
        process.cwd(),
        cleanPath
      );

      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
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

      const folderPath = path.join(
        process.cwd(),
        "uploads",
        "products",
        productId.toString()
      );

      if (await fs.pathExists(folderPath)) {
        await fs.remove(folderPath);
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