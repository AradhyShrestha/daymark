import bcrypt from "bcryptjs";
import { assertAuthConfiguration, createSession, mobileSessionResponse, publicUser } from "../../../../lib/auth";
import { getMongoErrorMessage, getUsersCollection } from "../../../../lib/mongodb";

export async function POST(request) {
  try {
    assertAuthConfiguration();
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return Response.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const token = await createSession(user._id.toString());
    return Response.json({ user: publicUser(user), ...mobileSessionResponse(request, token) });
  } catch (error) {
    console.error("Account sign-in failed.", error);
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}