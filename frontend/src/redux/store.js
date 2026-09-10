"use client";

import { configureStore } from "@reduxjs/toolkit";
import storeInfoReducer from "./slices/storeInfoSlice";

export const store = configureStore({
  reducer: {
    storeInfo: storeInfoReducer,
  },
});