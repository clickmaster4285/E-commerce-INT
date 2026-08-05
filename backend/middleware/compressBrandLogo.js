// const sharp = require("sharp");
// const fs = require("fs");

// const compressBrandLogo = async (req, res, next) => {
//   try {
//     // image nahi hai
//     if (!req.file) {
//       return next();
//     }

//     const outputPath = req.file.path.replace(/\.[^/.]+$/, ".webp");

//     await sharp(req.file.path)
//       .resize(300, 300, {
//         fit: "contain",
//         withoutEnlargement: true,
//       })
//       .webp({
//         quality: 80,
//       })
//       .toFile(outputPath);

//     // original image delete
//     fs.unlinkSync(req.file.path);

//     // req.file update
//     req.file.path = outputPath;
//     req.file.filename = outputPath.split("/").pop();
//     req.file.mimetype = "image/webp";

//     next();
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = compressBrandLogo;