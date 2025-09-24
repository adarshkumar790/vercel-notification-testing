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
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401,
    });
  }

  const json = JSON.parse(rawBody);
  const type = json.type;
  const deployment = json.payload?.deployment;

  if (!deployment) {
    return new Response("ignored", { status: 200 });
  }

  const creator = deployment.creator?.username || deployment.creator?.email || "Unknown";
  const url = deployment.url ? `https://${deployment.url}` : "";
  const commitMsg = deployment.meta?.githubCommitMessage || "";
  const commitAuthor = deployment.meta?.githubCommitAuthorName || creator;
  const project = deployment.project?.name || "Unknown Project";

  let content = "";
  if (type === "deployment.succeeded") {
    content = `✅ **Deployment Succeeded**  
**Project:** ${project}  
**Deployed by:** ${creator}  
**Commit:** ${commitMsg} — _${commitAuthor}_  
🔗 [View Deployment](${url})`;
  } else if (type === "deployment.ready") {
    content = `🚀 **Deployment Created**  
**Project:** ${project}  
**Deployed by:** ${creator}  
🔗 [Preview](${url})`;
  } else if (type === "deployment.error") {
    content = `❌ **Deployment Failed**  
**Project:** ${project}  
**Triggered by:** ${creator}`;
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
