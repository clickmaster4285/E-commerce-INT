import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  storeName: "My Store",
  tagline: "Welcome to our store",
  primaryColor: "#10b981",
  logo: null,
  storeStatus: "open",
  currency: "PKR",
  email: "store@example.com",
  phone: "",
  supportEmail: "",
  supportPhone: "",
  country: "PK",
  city: "",
  state: "",
  zipCode: "",
  address: "",
  taxRate: 0,
  weightUnit: "kg",
  maintenanceMessage: "",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  returnPolicy: "",
  privacyPolicy: "",
  termsConditions: "",
  socialLinks: {
    facebook: "",
    instagram: "",
    twitter: "",
    whatsapp: "",
    youtube: "",
    tiktok: "",
  },
  isLoaded: false,
};

const storeInfoSlice = createSlice({
  name: "storeInfo",
  initialState,
  reducers: {
    setStoreInfo(state, action) {
      const d = action.payload;
      if (!d) return;

      if (d.store_name !== undefined && d.store_name !== null) state.storeName = d.store_name;
      if (d.tagline !== undefined && d.tagline !== null) state.tagline = d.tagline;
      if (d.primary_color !== undefined && d.primary_color !== null) state.primaryColor = d.primary_color;
      if (d.logo !== undefined && d.logo !== null) state.logo = d.logo;
      if (d.store_status !== undefined && d.store_status !== null) state.storeStatus = d.store_status;
      if (d.currency !== undefined && d.currency !== null) state.currency = d.currency;
      if (d.email !== undefined && d.email !== null) state.email = d.email;
      if (d.phone !== undefined && d.phone !== null) state.phone = d.phone;
      if (d.support_email !== undefined && d.support_email !== null) state.supportEmail = d.support_email;
      if (d.support_phone !== undefined && d.support_phone !== null) state.supportPhone = d.support_phone;
      if (d.country !== undefined && d.country !== null) state.country = d.country;
      if (d.city !== undefined && d.city !== null) state.city = d.city;
      if (d.state !== undefined && d.state !== null) state.state = d.state;
      if (d.zip_code !== undefined && d.zip_code !== null) state.zipCode = d.zip_code;
      if (d.address !== undefined && d.address !== null) state.address = d.address;
      if (d.tax_rate !== undefined && d.tax_rate !== null) state.taxRate = d.tax_rate;
      if (d.weight_unit !== undefined && d.weight_unit !== null) state.weightUnit = d.weight_unit;
      if (d.maintenance_message !== undefined && d.maintenance_message !== null) state.maintenanceMessage = d.maintenance_message;
      if (d.meta_title !== undefined && d.meta_title !== null) state.metaTitle = d.meta_title;
      if (d.meta_description !== undefined && d.meta_description !== null) state.metaDescription = d.meta_description;
      if (d.meta_keywords !== undefined && d.meta_keywords !== null) state.metaKeywords = d.meta_keywords;
      if (d.return_policy !== undefined && d.return_policy !== null) state.returnPolicy = d.return_policy;
      if (d.privacy_policy !== undefined && d.privacy_policy !== null) state.privacyPolicy = d.privacy_policy;
      if (d.terms_conditions !== undefined && d.terms_conditions !== null) state.termsConditions = d.terms_conditions;
      if (d.social_links !== undefined && d.social_links !== null) state.socialLinks = d.social_links;

      state.isLoaded = true;

      // ✅ NO localStorage - tum cookies use karte ho
    },

    setStoreName(state, action) {
      state.storeName = action.payload;
      state.isLoaded = true;
    },

    resetStoreInfo() {
      return initialState;
    },
  },
});

export const { setStoreInfo, setStoreName, resetStoreInfo } =
  storeInfoSlice.actions;
export default storeInfoSlice.reducer;