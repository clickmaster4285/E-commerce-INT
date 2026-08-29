const fs = require("fs-extra");
const path = require("path");


// Delete single image
const deleteBrandImage = async (img_url) => {

  try {

    if (!img_url) return;


    const imagePath = path.join(
      __dirname,
      "..",
      img_url
    );


    if (await fs.pathExists(imagePath)) {

      await fs.remove(imagePath);

    }


  } catch(error){


  }

};




// Delete complete brand folder
const deleteBrandFolder = async (brandId) => {

  try {


    const folderPath = path.join(
      __dirname,
      "../uploads/brands",
      brandId.toString()
    );


    if(await fs.pathExists(folderPath)){

      await fs.remove(folderPath);

    }


  }catch(error){


  }

};



module.exports = {

  deleteBrandImage,

  deleteBrandFolder,

};