import { getToken } from "next-auth/jwt";

async function run() {
  const cookie = "__Secure-authjs.session-token=some-token-value;";
  console.log("With secureCookie:");
  try {
    await getToken({
      req: { headers: { cookie } },
      secret: "test",
      secureCookie: true
    });
    console.log("secureCookie works");
  } catch(e) { console.error(e.message); }

  console.log("With cookieName:");
  try {
    await getToken({
      req: { headers: { cookie } },
      secret: "test",
      cookieName: "__Secure-authjs.session-token"
    });
    console.log("cookieName works");
  } catch(e) { console.error(e.message); }
}
run();
