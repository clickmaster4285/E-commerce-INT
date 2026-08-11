// src/lib/auth.js
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload; // { userId, email, role }
  } catch (error) {
    console.error("Invalid session:", error.message);
    return null;
  }
}