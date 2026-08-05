const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");



const processBrandLogo = async (req, res, next) => {

  try {


    // image nahi hai to skip
    if (!req.file) {
      return next();
    }



    // update me existing brand id milegi
    // create me temporary folder banega
    const brandId =
      req.params.id || `temp_${Date.now()}`;



    const uploadFolder = path.join(
      __dirname,
      "../uploads/brands",
      brandId
    );



    await fs.ensureDir(uploadFolder);



    const fileName =
      `logo_${Date.now()}.webp`;



    const filePath =
      path.join(
        uploadFolder,
        fileName
      );



    // Logo resize + compress
    await sharp(req.file.buffer)

      .resize({
        width: 300,
        height: 300,
        fit: "contain",
      })

      .webp({
        quality: 85,
      })

      .toFile(filePath);




    const metadata =
      await sharp(filePath).metadata();



    const stats =
      await fs.stat(filePath);




    req.brandImage = {

      img_url:
      `uploads/brands/${brandId}/${fileName}`,

      img_size:
      stats.size,

      mimeType:
      "image/webp",

      width:
      metadata.width,

      height:
      metadata.height,

    };


    // ✅ Temporary folder ka naam yaad rakho — create ke baad rename karne ke liye
    req.tempBrandFolder = brandId;


    next();



  } catch(error){


    res.status(400).json({

      message:error.message

    });


  }


};



module.exports = processBrandLogo;