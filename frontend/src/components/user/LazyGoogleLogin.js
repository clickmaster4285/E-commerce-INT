"use client";

import dynamic from "next/dynamic";

/* GSI chunk sirf zaroorat par (ssr:false + dynamic) — home/search/product
   par kabhi load nahi hota. Load hone tak same-size placeholder taake
   layout shift na ho; clientId na ho to purana fallback text. */
const GoogleAuthInner = dynamic(() => import("./GoogleAuthInner"), {
  ssr: false,
  loading: () => <div style={{ width: 320, height: 40 }} />,
});

export default function LazyGoogleLogin({ clientId, unavailableClassName, ...googleProps }) {
  if (!clientId) {
    return (
      <div className={unavailableClassName}>Google login unavailable</div>
    );
  }
  return <GoogleAuthInner clientId={clientId} {...googleProps} />;
}
