import crypto from "crypto";

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL as string;
const VERCEL_SECRET = process.env.VERCEL_WEBHOOK_SECRET as string;

function sha1(data: Buffer, secret: string) {
  return crypto.createHmac("sha1", secret).update(data).digest("hex");
}

export async function POST(request: Request) {
  if (!DISCORD_WEBHOOK || !VERCEL_SECRET) {
    return new Response("Missing env vars", { status: 500 });
  }

  const rawBody = await request.text();
  const rawBuf = Buffer.from(rawBody, "utf8");
  const signature = sha1(rawBuf, VERCEL_SECRET);
  const incomingSig = request.headers.get("x-vercel-signature") || "";

  if (signature !== incomingSig) {
    return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
  }

  const json = JSON.parse(rawBody);
  const type = json.type;

  let content = "";
  if (type === "deployment.succeeded") {
    content = "Deployment Succeeded";
  } else if (type === "deployment.ready") {
    content = "Deployment Created";
  } else if (type === "deployment.error") {
    content = "Deployment Error";
  } else {
    return new Response("ignored", { status: 200 });
  }

  await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  return new Response("ok", { status: 200 });
}
