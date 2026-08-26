import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PORT = 4060;

const SOURCE = "https://edge.novastream.et/liveplay/43slLuTrhQRFkWzXA8o7D1Fre5ZOeryAxsvXsICGvPY/1787777223/3600/d0019c9d-5088-47a2-bb9a-ec5fff5b9b4a/abbay.m3u8";

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end("Method Not Allowed");
  }

  const requestUrl = new URL(
    req.url,
    `http://${req.headers.host}`
  );

  // --------------------------------------------------
  // Master / media playlist
  // --------------------------------------------------

  if (requestUrl.pathname === "/index.m3u8") {
    try {
      const playlist = await fetchText(SOURCE);

      const sourceUrl = new URL(SOURCE);

      const rewritten = playlist
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();

          // Keep comments/directives unchanged
          if (!trimmed || trimmed.startsWith("#")) {
            return line;
          }

          // Convert relative/absolute HLS URLs
          const absolute = new URL(trimmed, sourceUrl);

          return `/proxy?url=${encodeURIComponent(absolute.href)}`;
        })
        .join("\n");

      res.writeHead(200, {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });

      if (req.method === "HEAD") {
        return res.end();
      }

      return res.end(rewritten);
    } catch (error) {
      console.error("Playlist error:", error);

      res.writeHead(502);
      return res.end("Unable to fetch source playlist");
    }
  }

  // --------------------------------------------------
  // HLS segment / nested playlist proxy
  // --------------------------------------------------

  if (requestUrl.pathname === "/proxy") {
    const target = requestUrl.searchParams.get("url");

    if (!target) {
      res.writeHead(400);
      return res.end("Missing url");
    }

    let targetUrl;

    try {
      targetUrl = new URL(target);
    } catch {
      res.writeHead(400);
      return res.end("Invalid URL");
    }

    // Only allow HTTPS sources
    if (targetUrl.protocol !== "https:") {
      res.writeHead(400);
      return res.end("Only HTTPS sources are allowed");
    }

    try {
      return proxyRequest(targetUrl, req, res);
    } catch (error) {
      console.error("Proxy error:", error);

      if (!res.headersSent) {
        res.writeHead(502);
      }

      res.end("Proxy error");
    }
  }

  // --------------------------------------------------
  // 404
  // --------------------------------------------------

  res.writeHead(404);
  res.end("Not found");
});


// ==================================================
// FETCH TEXT
// ==================================================

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:")
      ? https
      : http;

    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "*/*",
        },
      },
      (response) => {
        if (
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          response.resume();

          return reject(
            new Error(
              `Source returned HTTP ${response.statusCode}`
            )
          );
        }

        let body = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          resolve(body);
        });
      }
    );

    request.setTimeout(10000, () => {
      request.destroy(
        new Error("Source request timeout")
      );
    });

    request.on("error", reject);
  });
}


// ==================================================
// STREAM PROXY
// ==================================================

function proxyRequest(targetUrl, req, res) {
  return new Promise((resolve, reject) => {
    const client = targetUrl.protocol === "https:"
      ? https
      : http;

    const proxy = client.get(
      targetUrl,
      {
        headers: {
          "User-Agent":
            req.headers["user-agent"] ||
            "Mozilla/5.0",

          "Accept":
            req.headers.accept ||
            "*/*",

          "Referer":
            req.headers.referer ||
            "",

          "Origin":
            req.headers.origin ||
            "",
        },
      },
      (response) => {

        if (
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          response.resume();

          if (!res.headersSent) {
            res.writeHead(
              response.statusCode || 502
            );
          }

          res.end();

          return resolve();
        }

        // Detect playlist
        const contentType =
          response.headers["content-type"] || "";

        const isPlaylist =
          targetUrl.pathname.endsWith(".m3u8") ||
          contentType.includes(
            "application/vnd.apple.mpegurl"
          ) ||
          contentType.includes(
            "application/x-mpegURL"
          );

        // ------------------------------------------------
        // Nested playlist
        // ------------------------------------------------

        if (isPlaylist) {
          let body = "";

          response.setEncoding("utf8");

          response.on("data", (chunk) => {
            body += chunk;
          });

          response.on("end", () => {
            const rewritten = body
              .split("\n")
              .map((line) => {
                const trimmed = line.trim();

                if (
                  !trimmed ||
                  trimmed.startsWith("#")
                ) {
                  return line;
                }

                const absolute =
                  new URL(
                    trimmed,
                    targetUrl
                  );

                return `/proxy?url=${encodeURIComponent(
                  absolute.href
                )}`;
              })
              .join("\n");

            res.writeHead(200, {
              "Content-Type":
                "application/vnd.apple.mpegurl",

              "Cache-Control":
                "no-cache, no-store, must-revalidate",
            });

            if (req.method === "HEAD") {
              return res.end();
            }

            res.end(rewritten);
            resolve();
          });

          return;
        }

        // ------------------------------------------------
        // Video/audio segment
        // ------------------------------------------------

        const headers = {
          "Content-Type":
            contentType ||
            "application/octet-stream",

          "Cache-Control":
            "public, max-age=3600, immutable",
        };

        if (response.headers["content-length"]) {
          headers["Content-Length"] =
            response.headers["content-length"];
        }

        res.writeHead(
          response.statusCode,
          headers
        );

        if (req.method === "HEAD") {
          response.resume();
          res.end();
          return resolve();
        }

        response.pipe(res);

        response.on("end", resolve);
      }
    );

    proxy.setTimeout(15000, () => {
      proxy.destroy(
        new Error("Upstream timeout")
      );
    });

    proxy.on("error", reject);

    req.on("close", () => {
      if (!res.writableEnded) {
        proxy.destroy();
      }
    });
  });
}


// ==================================================
// START
// ==================================================

server.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      `HLS proxy running on http://127.0.0.1:${PORT}`
    );

    console.log(
      `Playlist: http://127.0.0.1:${PORT}/index.m3u8`
    );
  }
);


// ==================================================
// SHUTDOWN
// ==================================================

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);