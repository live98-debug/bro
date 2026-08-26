import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

// =====================================================
// CONFIG
// =====================================================

const PORT = Number(process.env.PORT || 3000);

const FFMPEG_PATH =
  process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

const OUTPUT_DIR =
  path.resolve("./outputs");

const CONFIG_FILE =
  path.resolve("./stream-config.json");


// =====================================================
// LOAD STREAM CONFIG
// =====================================================

function loadConfig() {

  if (!fs.existsSync(CONFIG_FILE)) {

    console.error(
      `ERROR: Missing ${CONFIG_FILE}`
    );

    process.exit(1);
  }

  let config;

  try {

    config = JSON.parse(
      fs.readFileSync(
        CONFIG_FILE,
        "utf8"
      )
    );

  } catch (error) {

    console.error(
      "ERROR: Cannot read stream-config.json"
    );

    console.error(
      error.message
    );

    process.exit(1);
  }


  const required = [
    "video240p",
    "video360p",
    "video720p",
    "video1080p",
    "audio",
    "cookie"
  ];


  for (const key of required) {

    if (
      !config[key] ||
      typeof config[key] !== "string"
    ) {

      console.error(
        `ERROR: Missing config field: ${key}`
      );

      process.exit(1);
    }
  }


  return config;
}


const config =
  loadConfig();


// =====================================================
// SOURCE URLs
// =====================================================

const SOURCE_240P =
  config.video240p;

const SOURCE_360P =
  config.video360p;

const SOURCE_720P =
  config.video720p;

const SOURCE_1080P =
  config.video1080p;

const SOURCE_AUDIO =
  config.audio;


// =====================================================
// COOKIE
// =====================================================
//
// stream-config.json can contain:
//
// "cookie": "Cloud-CDN-Cookie=abc..."
//
// or:
//
// "cookie": "abc..."
//
// Both are supported.
// =====================================================

const cloudCdnCookie =
  config.cookie.replace(
    /^Cloud-CDN-Cookie=/,
    ""
  );


// =====================================================
// CREATE OUTPUT DIRECTORIES
// =====================================================

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true
  }
);


for (
  const quality of [
    "240p",
    "360p",
    "720p",
    "1080p"
  ]
) {

  fs.mkdirSync(
    path.join(
      OUTPUT_DIR,
      quality
    ),
    {
      recursive: true
    }
  );
}


// =====================================================
// MIME TYPES
// =====================================================

const MIME_TYPES = {

  ".m3u8":
    "application/vnd.apple.mpegurl",

  ".m4s":
    "video/iso.segment",

  ".mp4":
    "video/mp4",

  ".ts":
    "video/mp2t"

};


// =====================================================
// HTTP SERVER
// =====================================================

const server =
  http.createServer(
    (req, res) => {

      // =================================================
      // CORS PREFLIGHT
      // =================================================

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(
          204,
          {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods":
              "GET,HEAD,OPTIONS",
            "Access-Control-Allow-Headers": "*"
          }
        );

        res.end();

        return;
      }


      // =================================================
      // GET / HEAD ONLY
      // =================================================

      if (
        req.method !== "GET" &&
        req.method !== "HEAD"
      ) {

        res.writeHead(
          405
        );

        res.end(
          "Method Not Allowed"
        );

        return;
      }


      // =================================================
      // PARSE URL
      // =================================================

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

        res.writeHead(
          400
        );

        res.end(
          "Bad Request"
        );

        return;
      }


      // =================================================
      // REMOVE LEADING /
      // =================================================

      const relativePath =
        pathname.replace(
          /^\/+/,
          ""
        );


      // =================================================
      // ONLY HLS FILES
      // =================================================

      const extension =
        path.extname(
          relativePath
        ).toLowerCase();


      if (
        !MIME_TYPES[extension]
      ) {

        res.writeHead(
          404
        );

        res.end(
          "Not Found"
        );

        return;
      }


      // =================================================
      // PATH TRAVERSAL PROTECTION
      // =================================================

      if (
        relativePath.includes("..") ||
        relativePath.includes("\\") ||
        relativePath.startsWith("/")
      ) {

        res.writeHead(
          400
        );

        res.end(
          "Invalid path"
        );

        return;
      }


      // =================================================
      // RESOLVE FILE
      // =================================================

      const filePath =
        path.resolve(
          OUTPUT_DIR,
          relativePath
        );


      if (
        !filePath.startsWith(
          OUTPUT_DIR + path.sep
        )
      ) {

        res.writeHead(
          400
        );

        res.end(
          "Invalid path"
        );

        return;
      }


      // =================================================
      // CHECK FILE
      // =================================================

      if (
        !fs.existsSync(
          filePath
        )
      ) {

        res.writeHead(
          404,
          {
            "Cache-Control":
              "no-store"
          }
        );

        res.end(
          "HLS file not ready"
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

        res.writeHead(
          404
        );

        res.end(
          "Not Found"
        );

        return;
      }


      // =================================================
      // CACHE
      // =================================================

      const isPlaylist =
        extension === ".m3u8";


      const cacheControl =
        isPlaylist

          ? "no-cache, no-store, must-revalidate"

          : "public, max-age=3600, immutable";


      // =================================================
      // RESPONSE HEADERS
      // =================================================

      const headers = {

        "Content-Type":
          MIME_TYPES[extension],

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
          "bytes"

      };


      // =================================================
      // SEND HEADERS
      // =================================================

      res.writeHead(
        200,
        headers
      );


      // =================================================
      // HEAD REQUEST
      // =================================================

      if (
        req.method === "HEAD"
      ) {

        res.end();

        return;
      }


      // =================================================
      // STREAM FILE
      // =================================================

      const fileStream =
        fs.createReadStream(
          filePath
        );


      fileStream.pipe(
        res
      );


      fileStream.on(
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
// UPSTREAM HTTP HEADERS
// =====================================================

const HTTP_HEADERS =
  "Origin: https://adarash.com\r\n" +
  "Referer: https://adarash.com/\r\n" +
  `Cookie: Cloud-CDN-Cookie=${cloudCdnCookie}\r\n`;


// =====================================================
// FFMPEG ARGUMENTS
// =====================================================

const ffmpegArgs = [

  // ===================================================
  // 240P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_240P,


  // ===================================================
  // 360P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_360P,


  // ===================================================
  // 720P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_720P,


  // ===================================================
  // 1080P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_1080P,


  // ===================================================
  // SHARED AUDIO
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_AUDIO,


  // ===================================================
  // MAP 240P + AUDIO
  // ===================================================

  "-map",
  "0:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // MAP 360P + AUDIO
  // ===================================================

  "-map",
  "1:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // MAP 720P + AUDIO
  // ===================================================

  "-map",
  "2:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // MAP 1080P + AUDIO
  // ===================================================

  "-map",
  "3:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // VIDEO
  // ===================================================

  // Source video is already encoded.
  // Copying avoids CPU-heavy re-encoding.

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
  // VARIANT STREAM MAP
  // ===================================================

  "-var_stream_map",

  "v:0,a:0,name:240p " +
  "v:1,a:1,name:360p " +
  "v:2,a:2,name:720p " +
  "v:3,a:3,name:1080p",


  // ===================================================
  // INIT FILES
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
  // VARIANT PLAYLIST
  // ===================================================

  path.join(
    OUTPUT_DIR,
    "%v",
    "index.m3u8"
  )

];


// =====================================================
// START MESSAGE
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
  `FFmpeg: ${FFMPEG_PATH}`
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
// START FFMPEG
// =====================================================

const ffmpeg =
  spawn(
    FFMPEG_PATH,
    ffmpegArgs,
    {
      stdio: [
        "ignore",
        "ignore",
        "pipe"
      ]
    }
  );


// =====================================================
// FFMPEG STDERR
// =====================================================

ffmpeg.stderr.on(
  "data",
  (data) => {

    process.stderr.write(
      data.toString()
    );

  }
);


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
      `FFmpeg exited. code=${code}, signal=${signal}`
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

function shutdown(signal) {

  console.log("");

  console.log(
    `Received ${signal}`
  );

  console.log(
    "Stopping FFmpeg..."
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

      process.exit(
        0
      );

    }
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