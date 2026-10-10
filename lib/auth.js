import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { SignJWT, jwtVerify } from "jose";
import { getUsersCollection } from "./mongodb";

const SESSION_COOKIE = "daymark_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export function assertAuthConfiguration() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  getAuthSecret();
}

export async function createSession(userId) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return token;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(request) {
  const authorization = request?.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookieStore = bearerToken ? null : await cookies();
  const token = bearerToken ?? cookieStore?.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId;
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    userId = payload.sub;
  } catch {
    return null;
  }
  if (!userId || !ObjectId.isValid(userId)) return null;

  return getUsersCollection().then((users) => users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 0 } },
  ));
}

export function mobileSessionResponse(request, token) {
  return request.headers.get("x-daymark-client") === "android" ? { token } : {};
}

export function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    avatarDataUrl: user.avatarDataUrl ?? null,
  };
}