import * as jose from 'jose';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const R2_PUBLIC_HOST = "pub-f5b4cee090744ed2b73828a7e619786a.r2.dev";

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 2. Handle GET requests — CORS proxy for R2 images
    if (request.method === "GET") {
      return handleGetProxy(request, env);
    }

    // 3. Handle POST requests — Upload to R2
    if (request.method === "POST") {
      return handleUpload(request, env);
    }

    // 4. Handle DELETE requests — Delete from R2
    if (request.method === "DELETE") {
      return handleDelete(request, env);
    }

    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  },
};

/**
 * GET /proxy?url=https://pub-xxx.r2.dev/path/to/image.png
 * Fetches the image from R2 and returns it with proper CORS headers.
 */
async function handleGetProxy(request, env) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing 'url' query parameter", { status: 400, headers: CORS_HEADERS });
  }

  // Security: only allow proxying from our own R2 bucket
  try {
    const parsed = new URL(targetUrl);
    if (parsed.host !== R2_PUBLIC_HOST) {
      return new Response("Forbidden: Only R2 bucket URLs allowed", { status: 403, headers: CORS_HEADERS });
    }

    // Extract the key (path after the host)
    const key = parsed.pathname.slice(1); // remove leading /
    if (!key) {
      return new Response("Bad Request: No file path specified", { status: 400, headers: CORS_HEADERS });
    }

    // Fetch directly from R2 bucket binding (faster than external fetch)
    const object = await env.ASSETS_BUCKET.get(key);
    if (!object) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    }

    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/png");
    headers.set("Cache-Control", "public, max-age=31536000"); // Cache 1 year
    // CORS headers
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

    return new Response(object.body, { status: 200, headers });

  } catch (e) {
    console.error("Proxy error:", e);
    return new Response("Proxy Error: " + e.message, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST — Upload base64 image to R2 bucket (requires Firebase auth)
 */
async function handleUpload(request, env) {
  try {
    // Verify Authorization Header (Firebase ID Token)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized: Missing or invalid Authorization header", { status: 401, headers: CORS_HEADERS });
    }

    const token = authHeader.split(" ")[1];

    // Fetch Firebase public keys to verify JWT
    const jwks = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
    
    let payload;
    try {
      const { payload: jwtPayload } = await jose.jwtVerify(token, jwks, {
        issuer: 'https://securetoken.google.com/nhatot24h-84173',
        audience: 'nhatot24h-84173',
      });
      payload = jwtPayload;
    } catch (err) {
      return new Response("Invalid Token: " + err.message, { status: 401, headers: CORS_HEADERS });
    }

    // Parse request body
    const data = await request.json();
    if (!data.image || !data.filename) {
      return new Response("Bad Request: Missing image (base64) or filename", { status: 400, headers: CORS_HEADERS });
    }

    // Decode base64
    // Expecting format: "data:image/png;base64,iVBORw0KGgo..."
    const match = data.image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return new Response("Bad Request: Invalid base64 image format", { status: 400, headers: CORS_HEADERS });
    }
    
    const contentType = match[1];
    const base64String = match[2];
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate secure, unique filename scoped to the user
    const sanitizedName = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const safeFilename = `${payload.user_id}/${Date.now()}_${sanitizedName}`;

    // Upload to R2 Bucket
    await env.ASSETS_BUCKET.put(safeFilename, bytes, {
      httpMetadata: {
        contentType: contentType,
      },
    });

    // Return Public R2 URL
    const publicUrl = `https://${R2_PUBLIC_HOST}/${safeFilename}`;

    return new Response(JSON.stringify({ success: true, url: publicUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      }
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500, 
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      } 
    });
  }
}

/**
 * DELETE — Delete image from R2 bucket (requires Firebase auth & ownership verification)
 */
async function handleDelete(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized: Missing or invalid Authorization header", { status: 401, headers: CORS_HEADERS });
    }

    const token = authHeader.split(" ")[1];
    const jwks = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
    
    let payload;
    try {
      const { payload: jwtPayload } = await jose.jwtVerify(token, jwks, {
        issuer: 'https://securetoken.google.com/nhatot24h-84173',
        audience: 'nhatot24h-84173',
      });
      payload = jwtPayload;
    } catch (err) {
      return new Response("Invalid Token: " + err.message, { status: 401, headers: CORS_HEADERS });
    }

    const data = await request.json();
    if (!data.url) {
      return new Response("Bad Request: Missing url", { status: 400, headers: CORS_HEADERS });
    }

    const parsed = new URL(data.url);
    if (parsed.host !== R2_PUBLIC_HOST) {
        return new Response("Forbidden: Not an R2 URL", { status: 403, headers: CORS_HEADERS });
    }
    
    const key = parsed.pathname.slice(1); // remove leading /
    
    // Security check: Users can ONLY delete files inside their own user_id directory
    if (!key.startsWith(payload.user_id + "/")) {
        return new Response("Forbidden: Cannot delete files not belonging to you", { status: 403, headers: CORS_HEADERS });
    }

    await env.ASSETS_BUCKET.delete(key);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      }
    });
  } catch (e) {
    console.error("Delete error:", e);
    return new Response("Delete Error: " + e.message, { status: 500, headers: CORS_HEADERS });
  }
}
