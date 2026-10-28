import { checkPassword, createSession, sessionCookie } from "@/lib/auth";

// The login form posts here; success sets the session cookie and goes to
// /admin, failure goes back to the form. 303 so the browser follows with GET.
export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 750)); // slows down guessing
    return new Response(null, { status: 303, headers: { Location: "/admin/login?error=1" } });
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin", "Set-Cookie": sessionCookie(await createSession()) },
  });
}
