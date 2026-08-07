const Product = require("../models/Product");
const Variant = require("../models/Variant");

const { getNextSku } = require("../utils/skuHelper");

const {
  deleteImageFile,
  deleteProductUploadFolder,
} = require("../utils/uploadHelpers");


// ==========================================
// PARSE JSON
// ==========================================

const parseJSON = (value, fallback) => {
  try {
    if (typeof value === "string") {
      return JSON.parse(value);
    }

    return value ?? fallback;
  } catch {
    return fallback;
  }
};


// ==========================================
// CREATE PRODUCT
// ==========================================

const createProduct = async (req, res) => {
  let createdProduct = null;

  try {
    const variants = parseJSON(
      req.body.variants,
      []
    );

    const imageVariantIndexes = parseJSON(
      req.body.image_variant_indexes,
      []
    );

    if (!variants.length) {
      return res.status(400).json({
        message: "At least one variant is required",
      });
    }

    const productData = {
      name: req.body.name,
      category_id: req.body.category_id,
      brand_id: req.body.brand_id,
      description: req.body.description || "",
      tax: Number(req.body.tax || 0),

      status:
        req.body.status === "inactive"
          ? "inactive"
          : "active",

      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
    };

    if (req.productId) {
      productData._id = req.productId;
    }

    createdProduct = await Product.create(
      productData
    );

    const imagesByVariant = {};

    (req.savedImages || []).forEach(
      (image, fileIndex) => {
        const variantIndex =
          Number(
            imageVariantIndexes[fileIndex]
          ) || 0;

        if (!imagesByVariant[variantIndex]) {
          imagesByVariant[variantIndex] = [];
        }

        imagesByVariant[variantIndex].push(
          image
        );
      }
    );

    const createdVariants = [];
    const usedSkus = new Set();

    for (
      let index = 0;
      index < variants.length;
      index++
    ) {
      const item = variants[index];

      let sku = String(
        item.sku || ""
      ).trim();

      if (!sku) {
        sku = await getNextSku();
      }

      if (usedSkus.has(sku)) {
        throw new Error(
          `Duplicate SKU: ${sku}`
        );
      }

      const existingSku =
        await Variant.findOne({
          sku,
        });

      if (existingSku) {
        throw new Error(
          `SKU ${sku} already exists`
        );
      }

      usedSkus.add(sku);

      const variant =
        await Variant.create({
          product_id:
            createdProduct._id,

          sku,

          title:
            item.title ||
            item.variant_title ||
            sku,

          description:
            item.description || "",

          cost_price: Number(
            item.cost_price || 0
          ),

          selling_price: Number(
            item.selling_price || 0
          ),

          quantity: Number(
            item.quantity || 0
          ),

          min_qnt: Number(
            item.min_qnt || 0
          ),

          max_qnt: Number(
            item.max_qnt || 0
          ),

          attributes:
            item.attributes || {},

          images:
            imagesByVariant[index] || [],

          createdby:
            req.user?._id || null,

          updatedby:
            req.user?._id || null,
        });

      createdVariants.push(variant);
    }

    return res.status(201).json({
      message:
        "Product created successfully",

      product: createdProduct,

      variants: createdVariants,
    });

  } catch (error) {
    /*
      Product create fail ho jaye to incomplete
      product, variants aur uploaded files remove honge.
      Ye rollback hai, normal product delete nahi.
    */

    if (createdProduct) {
      await Variant.deleteMany({
        product_id:
          createdProduct._id,
      });

      await Product.findByIdAndDelete(
        createdProduct._id
      );

      await deleteProductUploadFolder(
        createdProduct._id
      );
    }

    return res.status(400).json({
      message: error.message,
    });
  }
};


// ==========================================
// GET ALL PRODUCTS
// ==========================================

const getProducts = async (req, res) => {
  try {
    const products = await Product.find({
      is_deleted: {
        $ne: true,
      },
    })
      .select("-__v")
      .populate(
        "category_id",
        "category_code name"
      )
      .populate(
        "brand_id",
        "brand_code name"
      );

    const result = await Promise.all(
      products.map(async (product) => {
        const variants =
          await Variant.find({
            product_id:
              product._id,
          }).select("-__v");

        return {
          ...product.toObject(),
          variants,
        };
      })
    );

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};


// ==========================================
// GET PRODUCT BY ID
// ==========================================

const getProductById = async (
  req,
  res
) => {
  try {
    const product =
      await Product.findOne({
        _id: req.params.id,

        is_deleted: {
          $ne: true,
        },
      })
        .select("-__v")
        .populate(
          "category_id",
          "category_code name"
        )
        .populate(
          "brand_id",
          "brand_code name"
        )
        .populate(
          "createdby",
          "email"
        )
        .populate(
          "updatedby",
          "email"
        );

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found",
      });
    }

    const variants =
      await Variant.find({
        product_id:
          product._id,
      }).select("-__v");

    return res.status(200).json({
      ...product.toObject(),

      variants,
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};


// ==========================================
// UPDATE PRODUCT AND VARIANTS
// ==========================================

const updateProduct = async (
  req,
  res
) => {
  try {
    const product =
      await Product.findOne({
        _id: req.params.id,

        is_deleted: {
          $ne: true,
        },
      });

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found",
      });
    }


    // ------------------------------------------
    // UPDATE PRODUCT INFORMATION
    // ------------------------------------------

    if (req.body.name !== undefined) {
      product.name =
        req.body.name;
    }

    if (
      req.body.category_id !==
      undefined
    ) {
      product.category_id =
        req.body.category_id;
    }

    if (
      req.body.brand_id !==
      undefined
    ) {
      product.brand_id =
        req.body.brand_id;
    }

    if (
      req.body.description !==
      undefined
    ) {
      product.description =
        req.body.description;
    }

    if (
      req.body.tax !== undefined
    ) {
      product.tax =
        Number(req.body.tax);
    }

    if (
      req.body.status !== undefined
    ) {
      product.status =
        req.body.status;
    }

    product.updatedby =
      req.user?._id || null;

    await product.save();


    // ------------------------------------------
    // READ INCOMING VARIANTS
    // ------------------------------------------

    const incomingVariants =
      parseJSON(
        req.body.variants,
        []
      );

    const imageVariantIndexes =
      parseJSON(
        req.body.image_variant_indexes,
        []
      );

    if (!incomingVariants.length) {
      return res.status(400).json({
        message:
          "At least one variant is required",
      });
    }


    // ------------------------------------------
    // GROUP NEW IMAGES BY VARIANT INDEX
    // ------------------------------------------

    const imagesByVariant = {};

    (req.savedImages || []).forEach(
      (image, fileIndex) => {
        const variantIndex =
          Number(
            imageVariantIndexes[
              fileIndex
            ]
          ) || 0;

        if (
          !imagesByVariant[
            variantIndex
          ]
        ) {
          imagesByVariant[
            variantIndex
          ] = [];
        }

        imagesByVariant[
          variantIndex
        ].push(image);
      }
    );


    /*
      Ye IDs un variants ki hain jo edit form se
      receive huye hain. Baad mein jo purana variant
      is list mein nahi hoga woh remove hoga.
    */

    const retainedVariantIds = [];

    /*
      Ek hi request ke andar duplicate SKU
      check karne ke liye.
    */

    const requestSkus = new Set();


    // ------------------------------------------
    // CREATE OR UPDATE EVERY VARIANT
    // ------------------------------------------

    for (
      let index = 0;
      index < incomingVariants.length;
      index++
    ) {
      const item =
        incomingVariants[index];

      let sku = String(
        item.sku || ""
      ).trim();

      if (!sku) {
        sku = await getNextSku();
      }


      // Same form mein duplicate SKU check

      if (requestSkus.has(sku)) {
        throw new Error(
          `Duplicate SKU: ${sku}`
        );
      }

      requestSkus.add(sku);


      // Existing images frontend se aa rahi hain

      const existingImages =
        Array.isArray(
          item.existing_images
        )
          ? item.existing_images
          : [];


      // Is variant ki newly uploaded images

      const newImages =
        imagesByVariant[index] || [];


      // ========================================
      // EXISTING VARIANT UPDATE
      // ========================================

      if (item._id) {
        const variant =
          await Variant.findOne({
            _id: item._id,

            product_id:
              product._id,
          });

        if (!variant) {
          throw new Error(
            `Variant not found for SKU ${sku}`
          );
        }


        // Database mein kisi aur variant ka same SKU

        const duplicate =
          await Variant.findOne({
            sku,

            _id: {
              $ne: variant._id,
            },
          });

        if (duplicate) {
          throw new Error(
            `SKU ${sku} already exists`
          );
        }


        /*
          Frontend se jo existing images receive hui hain
          woh retain hongi. Baqi removed images filesystem
          se delete hongi.
        */

        const retainedUrls =
          existingImages
            .map(
              (image) =>
                image?.img_url
            )
            .filter(Boolean);

        for (
          const oldImage of
          variant.images || []
        ) {
          if (
            !retainedUrls.includes(
              oldImage.img_url
            )
          ) {
            await deleteImageFile(
              oldImage.img_url
            );
          }
        }


        variant.sku = sku;

        variant.title =
          item.title ||
          item.variant_title ||
          sku;

        variant.description =
          item.description || "";

        variant.cost_price =
          Number(
            item.cost_price || 0
          );

        variant.selling_price =
          Number(
            item.selling_price || 0
          );

        variant.quantity =
          Number(
            item.quantity || 0
          );

        variant.min_qnt =
          Number(
            item.min_qnt || 0
          );

        variant.max_qnt =
          Number(
            item.max_qnt || 0
          );

        variant.attributes =
          item.attributes || {};

        variant.images = [
          ...existingImages,
          ...newImages,
        ];

        variant.updatedby =
          req.user?._id || null;

        await variant.save();

        retainedVariantIds.push(
          variant._id.toString()
        );
      }


      // ========================================
      // NEW SECOND/THIRD VARIANT CREATE
      // ========================================

      else {
        const duplicate =
          await Variant.findOne({
            sku,
          });

        if (duplicate) {
          throw new Error(
            `SKU ${sku} already exists`
          );
        }

        const variant =
          await Variant.create({
            product_id:
              product._id,

            sku,

            title:
              item.title ||
              item.variant_title ||
              sku,

            description:
              item.description || "",

            cost_price: Number(
              item.cost_price || 0
            ),

            selling_price: Number(
              item.selling_price || 0
            ),

            quantity: Number(
              item.quantity || 0
            ),

            min_qnt: Number(
              item.min_qnt || 0
            ),

            max_qnt: Number(
              item.max_qnt || 0
            ),

            attributes:
              item.attributes || {},

            images:
              newImages,

            createdby:
              req.user?._id || null,

            updatedby:
              req.user?._id || null,
          });

        retainedVariantIds.push(
          variant._id.toString()
        );
      }
    }


    // ------------------------------------------
    // REMOVE VARIANTS DELETED FROM EDIT FORM
    // ------------------------------------------

    const oldVariants =
      await Variant.find({
        product_id:
          product._id,
      });

    for (
      const variant of oldVariants
    ) {
      const variantId =
        variant._id.toString();

      if (
        !retainedVariantIds.includes(
          variantId
        )
      ) {
        for (
          const image of
          variant.images || []
        ) {
          await deleteImageFile(
            image.img_url
          );
        }

        await Variant.findByIdAndDelete(
          variant._id
        );
      }
    }


    // ------------------------------------------
    // GET FINAL UPDATED VARIANTS
    // ------------------------------------------

    const updatedVariants =
      await Variant.find({
        product_id:
          product._id,
      }).select("-__v");


    return res.status(200).json({
      message:
        "Product updated successfully",

      product,

      variants:
        updatedVariants,
    });

  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};


// ==========================================
// DELETE PRODUCT - SOFT DELETE
// ==========================================

const deleteProduct = async (
  req,
  res
) => {
  try {
    const product =
      await Product.findOne({
        _id: req.params.id,

        is_deleted: {
          $ne: true,
        },
      });

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found",
      });
    }

    product.is_deleted = true;

    product.deleted_at =
      new Date();

    product.deletedby =
      req.user?._id || null;

    await product.save();

    return res.status(200).json({
      message:
        "Product deleted successfully",
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};