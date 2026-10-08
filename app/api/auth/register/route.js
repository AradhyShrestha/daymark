import bcrypt from "bcryptjs";
import { assertAuthConfiguration, createSession, publicUser } from "../../../../lib/auth";
import { getMongoErrorMessage, getUsersCollection } from "../../../../lib/mongodb";

export async function POST(request) {
  try {
    assertAuthConfiguration();
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (username.length < 2 || username.length > 32) {
      return Response.json({ error: "Username must be between 2 and 32 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      return Response.json({ error: "Password must be at least 8 characters and no more than 72 bytes." }, { status: 400 });
    }

    const users = await getUsersCollection();
    const user = {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      avatarDataUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await users.insertOne(user);
    user._id = result.insertedId;
    await createSession(user._id.toString());
    return Response.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("Account registration failed.", error);
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}