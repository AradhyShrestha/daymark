import { getCurrentUser, publicUser } from "../../../../lib/auth";
import { getMongoErrorMessage, getUsersCollection } from "../../../../lib/mongodb";

const usernamePattern = /^[\p{L}\p{N} ._'’-]+$/u;
const avatarPattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    return Response.json({ user: user ? publicUser(user) : null });
  } catch (error) {
    console.error("Account session lookup failed.", error);
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in to update your account." }, { status: 401 });

    const body = await request.json();
    const updates = { updatedAt: new Date() };
    if (Object.hasOwn(body, "username")) {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      if (username.length < 2 || username.length > 32 || !usernamePattern.test(username)) {
        return Response.json({ error: "Use 2–32 letters, numbers, spaces, periods, apostrophes, or hyphens for your name." }, { status: 400 });
      }
      updates.username = username;
    }
    if (Object.hasOwn(body, "avatarDataUrl")) {
      const avatar = body.avatarDataUrl;
      if (avatar !== null) {
        const match = typeof avatar === "string" && avatar.length <= 850_000 && avatarPattern.exec(avatar);
        if (!match || Buffer.from(match[2], "base64").byteLength > 600_000) {
          return Response.json({ error: "Choose a PNG, JPEG, or WebP image under 600 KB." }, { status: 400 });
        }
      }
      updates.avatarDataUrl = avatar;
    }
    if (Object.keys(updates).length === 1) {
      return Response.json({ error: "No account changes were provided." }, { status: 400 });
    }

    const users = await getUsersCollection();
    await users.updateOne({ _id: user._id }, { $set: updates });
    return Response.json({ user: publicUser({ ...user, ...updates }) });
  } catch (error) {
    console.error("Account profile update failed.", error);
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}