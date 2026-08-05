const path = require("path");
const fs = require("fs-extra");

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
    console.error(
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
    console.error(
      "Product upload folder delete error:",
      error.message
    );
  }
};


module.exports = {
  deleteImageFile,
  deleteProductUploadFolder,
};