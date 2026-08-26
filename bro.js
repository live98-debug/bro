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

const PORT = Number(process.env.PORT || 3000);

const FFMPEG =
  process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

const OUTPUT_DIR =
  path.join(__dirname, "outputs");

const CONFIG_FILE =
  path.join(__dirname, "stream-config.json");

// =====================================================
// CONFIG
// =====================================================

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      `Missing ${CONFIG_FILE}`
    );
  }

  const raw =
    fs.readFileSync(
      CONFIG_FILE,
      "utf8"
    );

  const config =
    JSON.parse(raw);

  if (!config.cookie) {
    throw new Error(
      "stream-config.json: cookie is missing"
    );
  }

  if (!config.sources) {
    throw new Error(
      "stream-config.json: sources is missing"
    );
  }

  const requiredQualities = [
    "240p",
    "360p",
    "720p",
    "1080p",
  ];

  for (const quality of requiredQualities) {
    if (!config.sources[quality]) {
      throw new Error(
        `stream-config.json: ${quality} source is missing`
      );
    }
  }

  if (!config.audio) {
    throw new Error(
      "stream-config.json: audio source is missing"
    );
  }

  return config;
}

let config;

try {
  config = loadConfig();
} catch (error) {
  console.error(
    "CONFIG ERROR:",
    error.message
  );

  process.exit(1);
}

// =====================================================
// DIRECTORIES
// =====================================================

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

for (const quality of [
  "240p",
  "360p",
  "720p",
  "1080p",
]) {
  fs.mkdirSync(
    path.join(
      OUTPUT_DIR,
      quality
    ),
    {
      recursive: true,
    }
  );
}

// =====================================================
// COOKIE
// =====================================================

function extractCloudCookie(cookieHeader) {
  const match =
    cookieHeader.match(
      /(?:^|;\s*)Cloud-CDN-Cookie=([^;]+)/
    );

  if (!match) {
    throw new Error(
      "Cloud-CDN-Cookie was not found inside cookie"
    );
  }

  return match[1];
}

let cloudCdnCookie;

try {
  cloudCdnCookie =
    extractCloudCookie(
      config.cookie
    );
} catch (error) {
  console.error(
    "COOKIE ERROR:",
    error.message
  );

  process.exit(1);
}

// =====================================================
// HTTP HEADERS FOR SOURCE
// =====================================================

const HTTP_HEADERS =
  "Origin: https://adarash.com\r\n" +
  "Referer: https://adarash.com/\r\n" +
  `Cookie: Cloud-CDN-Cookie=${cloudCdnCookie}\r\n`;

// =====================================================
// SOURCE URLS
// =====================================================

const SOURCE_240 =
  config.sources["240p"];

const SOURCE_360 =
  config.sources["360p"];

const SOURCE_720 =
  config.sources["720p"];

const SOURCE_1080 =
  config.sources["1080p"];

const SOURCE_AUDIO =
  config.audio;

// =====================================================
// FFPROBE CHECK
// =====================================================

if (!fs.existsSync(FFMPEG)) {
  console.error("");
  console.error(
    "FFmpeg was not found:"
  );
  console.error(
    FFMPEG
  );
  console.error("");
  console.error(
    "On Ubuntu run:"
  );
  console.error(
    "sudo apt install ffmpeg"
  );
  console.error("");

  process.exit(1);
}

// =====================================================
// CLEAN OLD HLS FILES
// =====================================================

function cleanOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return;
  }

  const entries =
    fs.readdirSync(
      OUTPUT_DIR,
      {
        withFileTypes: true,
      }
    );

  for (const entry of entries) {
    const fullPath =
      path.join(
        OUTPUT_DIR,
        entry.name
      );

    fs.rmSync(
      fullPath,
      {
        recursive: true,
        force: true,
      }
    );
  }

  for (const quality of [
    "240p",
    "360p",
    "720p",
    "1080p",
  ]) {
    fs.mkdirSync(
      path.join(
        OUTPUT_DIR,
        quality
      ),
      {
        recursive: true,
      }
    );
  }
}

cleanOutputDirectory();

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

const server =
  http.createServer(
    (req, res) => {

      // -----------------------------------------------
      // CORS
      // -----------------------------------------------

      if (
        req.method === "OPTIONS"
      ) {
        res.writeHead(
          204,
          {
            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET, HEAD, OPTIONS",

            "Access-Control-Allow-Headers":
              "*",
          }
        );

        res.end();

        return;
      }

      // -----------------------------------------------
      // Only GET / HEAD
      // -----------------------------------------------

      if (
        req.method !== "GET" &&
        req.method !== "HEAD"
      ) {
        res.writeHead(
          405,
          {
            Allow:
              "GET, HEAD, OPTIONS",
          }
        );

        res.end();

        return;
      }

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
        res.writeHead(400);
        res.end(
          "Bad request"
        );

        return;
      }

      // -----------------------------------------------
      // Master playlist
      // -----------------------------------------------

      if (
        pathname ===
        "/teststream.m3u8"
      ) {
        serveFile(
          path.join(
            OUTPUT_DIR,
            "teststream.m3u8"
          ),
          res,
          req
        );

        return;
      }

      // -----------------------------------------------
      // Quality playlists / segments
      //
      // /hls/240p/index.m3u8
      // /hls/240p/segment-000001.m4s
      // -----------------------------------------------

      if (
        pathname.startsWith(
          "/hls/"
        )
      ) {

        const relative =
          pathname.slice(5);

        const parts =
          relative.split("/");

        if (
          parts.length !== 2
        ) {
          res.writeHead(404);
          res.end(
            "Not found"
          );

          return;
        }

        const quality =
          parts[0];

        const filename =
          parts[1];

        const allowedQualities = [
          "240p",
          "360p",
          "720p",
          "1080p",
        ];

        if (
          !allowedQualities.includes(
            quality
          )
        ) {
          res.writeHead(404);
          res.end(
            "Not found"
          );

          return;
        }

        // ---------------------------------------------
        // Prevent traversal
        // ---------------------------------------------

        if (
          filename.includes("..") ||
          filename.includes("/") ||
          filename.includes("\\")
        ) {
          res.writeHead(400);
          res.end(
            "Invalid path"
          );

          return;
        }

        const ext =
          path.extname(
            filename
          ).toLowerCase();

        if (
          !MIME_TYPES[ext]
        ) {
          res.writeHead(404);
          res.end(
            "Not found"
          );

          return;
        }

        const filePath =
          path.join(
            OUTPUT_DIR,
            quality,
            filename
          );

        serveFile(
          filePath,
          res,
          req
        );

        return;
      }

      res.writeHead(404);
      res.end(
        "Not found"
      );
    }
  );

// =====================================================
// FILE SERVER
// =====================================================

function serveFile(
  filePath,
  res,
  req
) {

  if (
    !fs.existsSync(
      filePath
    )
  ) {
    res.writeHead(
      404,
      {
        "Access-Control-Allow-Origin":
          "*",
      }
    );

    res.end(
      "Stream file not ready"
    );

    return;
  }

  let stat;

  try {
    stat =
      fs.statSync(
        filePath
      );
  } catch {
    res.writeHead(404);
    res.end(
      "Not found"
    );

    return;
  }

  const ext =
    path.extname(
      filePath
    ).toLowerCase();

  const isPlaylist =
    ext === ".m3u8";

  const headers = {
    "Content-Type":
      MIME_TYPES[ext] ||
      "application/octet-stream",

    "Content-Length":
      stat.size,

    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, HEAD, OPTIONS",

    "Access-Control-Allow-Headers":
      "*",

    "Accept-Ranges":
      "bytes",

    "Connection":
      "keep-alive",
  };

  // Live playlists should not be cached.
  if (isPlaylist) {
    headers[
      "Cache-Control"
    ] =
      "no-cache, no-store, must-revalidate";

    headers[
      "Pragma"
    ] =
      "no-cache";

    headers[
      "Expires"
    ] =
      "0";
  } else {
    // HLS segments are immutable.
    headers[
      "Cache-Control"
    ] =
      "public, max-age=3600, immutable";
  }

  res.writeHead(
    200,
    headers
  );

  if (
    req.method === "HEAD"
  ) {
    res.end();

    return;
  }

  const stream =
    fs.createReadStream(
      filePath
    );

  stream.pipe(
    res
  );

  stream.on(
    "error",
    () => {

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

// =====================================================
// FFMPEG ARGUMENTS
// =====================================================

const ffmpegArgs = [

  // ---------------------------------------------------
  // 240p
  // ---------------------------------------------------

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_240,

  // ---------------------------------------------------
  // 360p
  // ---------------------------------------------------

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_360,

  // ---------------------------------------------------
  // 720p
  // ---------------------------------------------------

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_720,

  // ---------------------------------------------------
  // 1080p
  // ---------------------------------------------------

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_1080,

  // ---------------------------------------------------
  // Shared audio
  // ---------------------------------------------------

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_AUDIO,

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
  // CODECS
  // ===================================================

  // Source videos are already encoded.
  // Do not re-encode them.
  "-c:v",
  "copy",

  // Encode shared audio once for HLS.
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

  "-var_stream_map",
  "v:0,a:0,name:240p " +
  "v:1,a:1,name:360p " +
  "v:2,a:2,name:720p " +
  "v:3,a:3,name:1080p",

  // ===================================================
  // fMP4
  // ===================================================

  "-hls_fmp4_init_filename",
  "init.mp4",

  // ===================================================
  // SEGMENTS
  // ===================================================

  "-hls_segment_filename",
  path.join(
    OUTPUT_DIR,
    "%v",
    "segment-%06d.m4s"
  ),

  // ===================================================
  // PLAYLISTS
  // ===================================================

  path.join(
    OUTPUT_DIR,
    "%v",
    "index.m3u8"
  ),
];

// =====================================================
// STARTUP LOG
// =====================================================

console.log("");
console.log(
  "========================================"
);

console.log(
  "      HLS MULTI-QUALITY RESTREAM"
);

console.log(
  "========================================"
);

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

// =====================================================
// START FFMPEG ONCE
// =====================================================

let ffmpeg;

function startFFmpeg() {

  console.log(
    "Starting FFmpeg..."
  );

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

  ffmpeg.stderr.on(
    "data",
    (data) => {

      process.stderr.write(
        data.toString()
      );
    }
  );

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

  ffmpeg.on(
    "close",
    (code, signal) => {

      console.log("");
      console.log(
        `FFmpeg exited. code=${code}, signal=${signal}`
      );

      // Do not immediately restart.
      // This prevents a tight restart loop
      // if the source credentials have expired.

      if (
        !shuttingDown
      ) {

        console.log(
          "FFmpeg stopped."
        );

        console.log(
          "Update stream-config.json and restart the service."
        );
      }
    }
  );
}

startFFmpeg();

// =====================================================
// SERVER ERROR HANDLER
// =====================================================

server.on(
  "error",
  (error) => {

    if (
      error.code ===
      "EADDRINUSE"
    ) {

      console.error(
        `Port ${PORT} is already in use.`
      );

      console.error(
        `Run: sudo lsof -i :${PORT}`
      );

      process.exit(1);

      return;
    }

    console.error(
      "HTTP server error:",
      error
    );
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
// SHUTDOWN
// =====================================================

let shuttingDown = false;

function shutdown() {

  if (
    shuttingDown
  ) {
    return;
  }

  shuttingDown = true;

  console.log("");
  console.log(
    "Stopping HLS server..."
  );

  if (
    ffmpeg &&
    !ffmpeg.killed
  ) {
    ffmpeg.kill(
      "SIGTERM"
    );
  }

  server.close(
    () => {
      console.log(
        "HTTP server stopped."
      );

      process.exit(0);
    }
  );

  // Safety timeout.
  setTimeout(
    () => {
      process.exit(0);
    },
    5000
  ).unref();
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);