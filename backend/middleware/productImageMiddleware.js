const sharp = require("sharp");
const upload = require("../config/uploadConfig");

const productImagesUpload = upload.array("images", 10);


const validateProductImages = async (req, res, next) => {
  try {

    if (!req.files || req.files.length === 0) {
      return next();
    }


    const imageMetadata = [];


    for (const file of req.files) {


      const metadata = await sharp(file.buffer).metadata();

      // Resolution restriction removed - any valid image size accepted

      imageMetadata.push({

        originalName: file.originalname,

        img_size: file.size,

        mimeType: file.mimetype,

        width: metadata.width,

        height: metadata.height,

      });

    }


    req.imageMetadata = imageMetadata;


    next();


  } catch(error){

    return res.status(400).json({
      message:"Image validation failed"
    });

  }
};


module.exports = {
  productImagesUpload,
  validateProductImages,
};