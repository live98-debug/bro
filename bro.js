import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

// =====================================================
// PATHS
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, "stream-config.json");
const OUTPUT_DIR = path.join(__dirname, "outputs");

// =====================================================
// LOAD CONFIG
// =====================================================

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("CONFIG ERROR: stream-config.json not found");
  process.exit(1);
}

let config;

try {
  config = JSON.parse(
    fs.readFileSync(CONFIG_FILE, "utf8")
  );
} catch (error) {
  console.error("CONFIG ERROR: invalid JSON");
  console.error(error.message);
  process.exit(1);
}

// =====================================================
// VALIDATE CONFIG
// =====================================================

if (!config.sources) {
  console.error("CONFIG ERROR: sources object is missing");
  process.exit(1);
}

const requiredQualities = [
  "240p",
  "360p",
  "720p",
  "1080p",
];

for (const quality of requiredQualities) {
  if (
    typeof config.sources[quality] !== "string" ||
    !config.sources[quality]
  ) {
    console.error(
      `CONFIG ERROR: ${quality} source is missing`
    );

    process.exit(1);
  }
}

if (
  typeof config.sources.audio !== "string" ||
  !config.sources.audio
) {
  console.error(
    "CONFIG ERROR: sources.audio is missing"
  );

  process.exit(1);
}

if (
  !config.headers ||
  typeof config.headers.origin !== "string" ||
  typeof config.headers.referer !== "string"
) {
  console.error(
    "CONFIG ERROR: headers.origin or headers.referer is missing"
  );

  process.exit(1);
}

if (
  typeof config.cookie !== "string" ||
  !config.cookie
) {
  console.error(
    "CONFIG ERROR: cookie is missing"
  );

  process.exit(1);
}

// =====================================================
// SETTINGS
// =====================================================

const PORT = Number(config.port || 3000);

const FFMPEG =
  config.ffmpegPath || "ffmpeg";

const SOURCES = config.sources;

const OUTPUT_ROOT = OUTPUT_DIR;

// =====================================================
// CREATE OUTPUT DIRECTORIES
// =====================================================

fs.mkdirSync(
  OUTPUT_ROOT,
  {
    recursive: true,
  }
);

for (const quality of requiredQualities) {
  const dir = path.join(
    OUTPUT_ROOT,
    quality
  );

  fs.mkdirSync(dir, {
    recursive: true,
  });
}

// =====================================================
// CLEAN OLD HLS FILES
// =====================================================

function cleanOutputDirectory() {
  for (const quality of requiredQualities) {
    const dir = path.join(
      OUTPUT_ROOT,
      quality
    );

    if (!fs.existsSync(dir)) {
      continue;
    }

    for (const file of fs.readdirSync(dir)) {
      try {
        fs.unlinkSync(
          path.join(dir, file)
        );
      } catch {
        // Ignore files that cannot be removed.
      }
    }
  }

  const master =
    path.join(
      OUTPUT_ROOT,
      "teststream.m3u8"
    );

  try {
    if (fs.existsSync(master)) {
      fs.unlinkSync(master);
    }
  } catch {
    // Ignore
  }
}

cleanOutputDirectory();

// =====================================================
// HTTP HEADERS FOR SOURCE SERVER
// =====================================================

const HTTP_HEADERS =
  `Origin: ${config.headers.origin}\r\n` +
  `Referer: ${config.headers.referer}\r\n` +
  `Cookie: ${config.cookie}\r\n`;

// =====================================================
// HTTP SERVER
// =====================================================

const MIME_TYPES = {
  ".m3u8":
    "application/vnd.apple.mpegurl",

  ".m4s":
    "video/iso.segment",

  ".mp4":
    "video/mp4",

  ".ts":
    "video/mp2t",
};

function sendError(
  res,
  status,
  message
) {
  if (!res.headersSent) {
    res.writeHead(status, {
      "Content-Type":
        "text/plain; charset=utf-8",
      "Cache-Control":
        "no-store",
    });
  }

  res.end(message);
}

const server =
  http.createServer(
    (req, res) => {

      // -----------------------------------------------
      // CORS / OPTIONS
      // -----------------------------------------------

      if (
        req.method === "OPTIONS"
      ) {
        res.writeHead(204, {
          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Methods":
            "GET,HEAD,OPTIONS",

          "Access-Control-Allow-Headers":
            "*",

          "Access-Control-Max-Age":
            "86400",
        });

        res.end();

        return;
      }

      // -----------------------------------------------
      // GET / HEAD ONLY
      // -----------------------------------------------

      if (
        req.method !== "GET" &&
        req.method !== "HEAD"
      ) {
        sendError(
          res,
          405,
          "Method Not Allowed"
        );

        return;
      }

      // -----------------------------------------------
      // PARSE URL
      // -----------------------------------------------

      let pathname;

      try {
        pathname =
          decodeURIComponent(
            new URL(
              req.url,
              `http://${req.headers.host}`
            ).pathname
          );
      } catch {
        sendError(
          res,
          400,
          "Bad request"
        );

        return;
      }

      // -----------------------------------------------
      // MASTER PLAYLIST
      //
      // /teststream.m3u8
      // -----------------------------------------------

      let filePath;

      if (
        pathname ===
        "/teststream.m3u8"
      ) {
        filePath =
          path.join(
            OUTPUT_ROOT,
            "teststream.m3u8"
          );
      }

      // -----------------------------------------------
      // QUALITY PLAYLISTS
      //
      // /240p/index.m3u8
      // /360p/index.m3u8
      // etc.
      // -----------------------------------------------

      else if (
        pathname.startsWith(
          "/240p/"
        ) ||
        pathname.startsWith(
          "/360p/"
        ) ||
        pathname.startsWith(
          "/720p/"
        ) ||
        pathname.startsWith(
          "/1080p/"
        )
      ) {

        const relative =
          pathname.replace(
            /^\/+/,
            ""
          );

        const parts =
          relative.split("/");

        if (parts.length !== 2) {
          sendError(
            res,
            400,
            "Invalid path"
          );

          return;
        }

        const quality =
          parts[0];

        const filename =
          parts[1];

        if (
          !requiredQualities.includes(
            quality
          )
        ) {
          sendError(
            res,
            404,
            "Not found"
          );

          return;
        }

        if (
          filename.includes("..") ||
          filename.includes("/") ||
          filename.includes("\\")
        ) {
          sendError(
            res,
            400,
            "Invalid path"
          );

          return;
        }

        filePath =
          path.join(
            OUTPUT_ROOT,
            quality,
            filename
          );
      }

      // -----------------------------------------------
      // UNKNOWN PATH
      // -----------------------------------------------

      else {
        sendError(
          res,
          404,
          "Not found"
        );

        return;
      }

      // -----------------------------------------------
      // SECURITY CHECK
      // -----------------------------------------------

      const resolvedOutput =
        path.resolve(
          OUTPUT_ROOT
        );

      const resolvedFile =
        path.resolve(
          filePath
        );

      if (
        !resolvedFile.startsWith(
          resolvedOutput +
            path.sep
        ) &&
        resolvedFile !==
          resolvedOutput
      ) {
        sendError(
          res,
          403,
          "Forbidden"
        );

        return;
      }

      // -----------------------------------------------
      // FILE EXISTS?
      // -----------------------------------------------

      if (
        !fs.existsSync(
          resolvedFile
        )
      ) {
        sendError(
          res,
          404,
          "Stream segment not ready"
        );

        return;
      }

      let stat;

      try {
        stat =
          fs.statSync(
            resolvedFile
          );
      } catch {
        sendError(
          res,
          404,
          "Not found"
        );

        return;
      }

      // -----------------------------------------------
      // MIME TYPE
      // -----------------------------------------------

      const ext =
        path.extname(
          resolvedFile
        ).toLowerCase();

      const contentType =
        MIME_TYPES[ext] ||
        "application/octet-stream";

      // -----------------------------------------------
      // CACHE POLICY
      // -----------------------------------------------

      let cacheControl;

      if (
        ext === ".m3u8"
      ) {
        cacheControl =
          "no-cache, no-store, must-revalidate";
      } else {
        cacheControl =
          "public, max-age=3600, immutable";
      }

      // -----------------------------------------------
      // RESPONSE HEADERS
      // -----------------------------------------------

      const headers = {
        "Content-Type":
          contentType,

        "Content-Length":
          stat.size,

        "Cache-Control":
          cacheControl,

        "Access-Control-Allow-Origin":
          "*",

        "Access-Control-Allow-Methods":
          "GET,HEAD,OPTIONS",

        "Access-Control-Allow-Headers":
          "*",

        "Accept-Ranges":
          "bytes",
      };

      // -----------------------------------------------
      // HEAD
      // -----------------------------------------------

      if (
        req.method === "HEAD"
      ) {
        res.writeHead(
          200,
          headers
        );

        res.end();

        return;
      }

      // -----------------------------------------------
      // STREAM FILE
      // -----------------------------------------------

      res.writeHead(
        200,
        headers
      );

      const stream =
        fs.createReadStream(
          resolvedFile
        );

      stream.pipe(res);

      stream.on(
        "error",
        (error) => {
          console.error(
            "File stream error:",
            error.message
          );

          if (
            !res.headersSent
          ) {
            res.writeHead(
              500
            );
          }

          res.end();
        }
      );
    }
  );

// =====================================================
// FFMPEG ARGUMENTS
// =====================================================

const ffmpegArgs = [

  // ===================================================
  // 240p INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["240p"],


  // ===================================================
  // 360p INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["360p"],


  // ===================================================
  // 720p INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["720p"],


  // ===================================================
  // 1080p INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["1080p"],


  // ===================================================
  // SHARED AUDIO INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["audio"],


  // ===================================================
  // VIDEO + AUDIO MAPPING
  // ===================================================

  "-map",
  "0:v:0",

  "-map",
  "4:a:0",

  "-map",
  "1:v:0",

  "-map",
  "4:a:0",

  "-map",
  "2:v:0",

  "-map",
  "4:a:0",

  "-map",
  "3:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // VIDEO
  // ===================================================

  // All source videos are already encoded.
  // Do not re-encode them.

  "-c:v",
  "copy",


  // ===================================================
  // AUDIO
  // ===================================================

  "-c:a",
  "aac",

  "-b:a",
  "128k",

  "-ar",
  "48000",


  // ===================================================
  // HLS
  // ===================================================

  "-f",
  "hls",

  "-hls_segment_type",
  "fmp4",

  "-hls_time",
  "4",

  "-hls_list_size",
  "8",

  "-hls_flags",
  "delete_segments+append_list+independent_segments",


  // ===================================================
  // MASTER PLAYLIST
  // ===================================================

  "-master_pl_name",
  "teststream.m3u8",


  // ===================================================
  // VARIANT STREAMS
  // ===================================================

  "-var_stream_map",
  "v:0,a:0,name:240p " +
  "v:1,a:1,name:360p " +
  "v:2,a:2,name:720p " +
  "v:3,a:3,name:1080p",


  // ===================================================
  // INIT SEGMENTS
  // ===================================================

  "-hls_fmp4_init_filename",
  "init.mp4",


  // ===================================================
  // SEGMENTS
  // ===================================================

  "-hls_segment_filename",
  path.join(
    OUTPUT_ROOT,
    "%v",
    "segment-%06d.m4s"
  ),


  // ===================================================
  // PLAYLISTS
  // ===================================================

  path.join(
    OUTPUT_ROOT,
    "%v",
    "index.m3u8"
  ),
];

// =====================================================
// START FFMPEG
// =====================================================

console.log("");
console.log("========================================");
console.log("      HLS MULTI-QUALITY RESTREAM");
console.log("========================================");
console.log("");

console.log(
  `FFmpeg: ${FFMPEG}`
);

console.log("");

console.log(
  "240p  -> source 240p"
);

console.log(
  "360p  -> source 360p"
);

console.log(
  "720p  -> source 720p"
);

console.log(
  "1080p -> source 1080p"
);

console.log(
  "Audio -> shared audio source"
);

console.log("");

console.log(
  `Master HLS: http://localhost:${PORT}/teststream.m3u8`
);

console.log("");

let ffmpeg;

try {

  ffmpeg =
    spawn(
      FFMPEG,
      ffmpegArgs,
      {
        stdio: [
          "ignore",
          "ignore",
          "pipe",
        ],
      }
    );

} catch (error) {

  console.error(
    "Failed to start FFmpeg:"
  );

  console.error(
    error
  );

  process.exit(1);
}

// =====================================================
// FFMPEG ERROR
// =====================================================

ffmpeg.on(
  "error",
  (error) => {

    console.error("");
    console.error(
      "========================================"
    );

    console.error(
      "FFmpeg failed"
    );

    console.error(
      "========================================"
    );

    console.error(
      error
    );

    console.error("");
  }
);

// =====================================================
// FFMPEG LOG
// =====================================================

ffmpeg.stderr.on(
  "data",
  (data) => {

    const message =
      data.toString();

    process.stderr.write(
      message
    );
  }
);

// =====================================================
// FFMPEG EXIT
// =====================================================

ffmpeg.on(
  "close",
  (code, signal) => {

    console.log("");
    console.log(
      "========================================"
    );

    console.log(
      `FFmpeg exited. code=${code}, signal=${signal}`
    );

    console.log(
      "========================================"
    );

  }
);

// =====================================================
// SERVER ERROR
// =====================================================

server.on(
  "error",
  (error) => {

    if (
      error.code ===
      "EADDRINUSE"
    ) {

      console.error(
        `ERROR: Port ${PORT} is already in use.`
      );

      console.error(
        `Run: sudo lsof -i :${PORT}`
      );

      console.error(
        `Then stop the old process.`
      );

    } else {

      console.error(
        "HTTP server error:",
        error
      );
    }

    if (
      ffmpeg &&
      !ffmpeg.killed
    ) {
      ffmpeg.kill(
        "SIGTERM"
      );
    }

    process.exit(1);
  }
);

// =====================================================
// START HTTP SERVER
// =====================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `HTTP server listening on :${PORT}`
    );

    console.log("");

    console.log(
      `Master HLS: http://localhost:${PORT}/teststream.m3u8`
    );

    console.log("");
  }
);

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

let shuttingDown = false;

function shutdown(
  signal
) {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log("");
  console.log(
    `Received ${signal}. Stopping...`
  );

  // Stop FFmpeg first.
  if (
    ffmpeg &&
    !ffmpeg.killed
  ) {

    ffmpeg.kill(
      "SIGTERM"
    );

    setTimeout(
      () => {

        if (
          ffmpeg &&
          !ffmpeg.killed
        ) {
          ffmpeg.kill(
            "SIGKILL"
          );
        }

      },
      5000
    );
  }

  // Stop HTTP server.
  server.close(
    () => {

      console.log(
        "HTTP server stopped."
      );

      process.exit(0);
    }
  );

  // Don't wait forever.
  setTimeout(
    () => {
      process.exit(0);
    },
    7000
  );
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);