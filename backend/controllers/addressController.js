const Address = require("../models/Address");

// GET /api/addresses — meri addresses
const getMyAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user_id: req.user._id })
      .sort({ is_default: -1, created_at: -1 })
      .lean();
    res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/addresses — nayi address
const createAddress = async (req, res) => {
  try {
    const { country, full_name, street_address1, street_address2, city, state, zip_code, phone, is_default } = req.body;

    if (!full_name || !street_address1 || !city || !state || !phone) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    if (is_default) {
      await Address.updateMany({ user_id: req.user._id }, { is_default: false });
    }

    const address = await Address.create({
      user_id: req.user._id,
      country: country || "Pakistan",
      full_name,
      street_address1,
      street_address2: street_address2 || "",
      city,
      state,
      zip_code: zip_code || "",
      phone,
      is_default: !!is_default,
    });

    res.status(201).json({ success: true, data: address });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/addresses/:id — update
const updateAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });

    const fields = ["country", "full_name", "street_address1", "street_address2", "city", "state", "zip_code", "phone"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) address[f] = req.body[f];
    });

    if (req.body.is_default === true) {
      await Address.updateMany({ user_id: req.user._id, _id: { $ne: address._id } }, { is_default: false });
      address.is_default = true;
    }

    await address.save();
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/addresses/:id
const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });
    res.status(200).json({ success: true, message: "Address deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/addresses/:id/default — default set
const setDefaultAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });

    await Address.updateMany({ user_id: req.user._id }, { is_default: false });
    address.is_default = true;
    await address.save();

    res.status(200).json({ success: true, data: address });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};