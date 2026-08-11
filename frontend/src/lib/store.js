// // frontend/src/lib/store.js
// import { create } from 'zustand';

// // Yeh hamara global "Notice Board" hai
// export const useAppStore = create((set) => ({
//   // Default values (agar database se kuch na aaye toh yeh dikhega)
//   storeName: 'Clic
//   // Yeh function data update karega
//   setStoreInfo: (info) => set((state) => ({ 
//     storeName: info.store_name || state.storeName
//   })),
// }));