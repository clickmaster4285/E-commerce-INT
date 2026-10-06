"use client";

import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

/* Local provider — GSI script sirf tab load hota hai jab ye mount ho
   (login modal / login page). Global provider hataya gaya taake home,
   search, product, brand pages par 100KB GSI JS na aaye. Props/behavior
   bilkul same (GoogleLogin ko as-is forward). */
export default function GoogleAuthInner({ clientId, ...googleProps }) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleLogin {...googleProps} />
    </GoogleOAuthProvider>
  );
}
