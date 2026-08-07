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


      // Minimum resolution check
      const MIN_WIDTH = 1000;
      const MIN_HEIGHT = 1000;


      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width < MIN_WIDTH ||
        metadata.height < MIN_HEIGHT
      ) {

        return res.status(400).json({
          message:
            `Image resolution must be at least ${MIN_WIDTH}x${MIN_HEIGHT}px`
        });

      }


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