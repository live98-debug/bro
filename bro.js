import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

// =====================================================
// CONFIG
// =====================================================

const PORT = Number(process.env.PORT || 3000);

const FFMPEG_PATH =
  process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

const OUTPUT_DIR =
  path.resolve("./outputs");

// =====================================================
// SOURCE HLS
// =====================================================

const SOURCE_240P =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-240p/index-1.m3u8";

const SOURCE_360P =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-360p/index-1.m3u8";

const SOURCE_720P =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-720p/index-1.m3u8";

const SOURCE_1080P =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-1080p/index-1.m3u8";

const SOURCE_AUDIO =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-audio/index-1.m3u8";

// =====================================================
// COOKIE
// =====================================================
//
// Set this when starting the application:
//
// export BROWSER_COOKIE='tt_enable_cookie=...; Cloud-CDN-Cookie=...'
//
// We extract only Cloud-CDN-Cookie below.
// =====================================================

const BROWSER_COOKIE =
  process.env.BROWSER_COOKIE || "";

if (!BROWSER_COOKIE) {
  console.error(
    "ERROR: BROWSER_COOKIE environment variable is missing."
  );

  process.exit(1);
}


// =====================================================
// EXTRACT CLOUD CDN COOKIE
// =====================================================

function extractCloudCookie(cookieHeader) {

  const match = cookieHeader.match(
    /(?:^|;\s*)Cloud-CDN-Cookie=([^;]+)/
  );

  if (!match) {
    throw new Error(
      "Cloud-CDN-Cookie was not found in BROWSER_COOKIE"
    );
  }

  return match[1];
}

let cloudCdnCookie;

try {

  cloudCdnCookie =
    extractCloudCookie(
      BROWSER_COOKIE
    );

} catch (error) {

  console.error(
    "Cookie error:",
    error.message
  );

  process.exit(1);
}


// =====================================================
// CREATE OUTPUT DIRECTORY
// =====================================================

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);


// =====================================================
// CREATE VARIANT DIRECTORIES
// =====================================================

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
    "video/mp2t",

};


// =====================================================
// HTTP SERVER
// =====================================================

const server =
  http.createServer(
    (req, res) => {

      // =================================================
      // CORS / OPTIONS
      // =================================================

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(
          204,
          {
            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET,HEAD,OPTIONS",

            "Access-Control-Allow-Headers":
              "*",
          }
        );

        res.end();

        return;
      }


      // =================================================
      // ONLY GET / HEAD
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
      // REMOVE LEADING SLASH
      // =================================================

      let relativePath =
        pathname.replace(
          /^\/+/,
          ""
        );


      // =================================================
      // ONLY SERVE HLS FILES
      // =================================================

      const ext =
        path.extname(
          relativePath
        ).toLowerCase();


      if (
        !MIME_TYPES[ext]
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
      // PATH SECURITY
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
      // RESOLVE PATH
      // =================================================

      const filePath =
        path.resolve(
          OUTPUT_DIR,
          relativePath
        );


      // =================================================
      // PREVENT PATH TRAVERSAL
      // =================================================

      if (
        filePath !== OUTPUT_DIR &&
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
      // FILE EXISTS
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
              "no-store",
          }
        );

        res.end(
          "HLS file not ready"
        );

        return;
      }


      // =================================================
      // STAT
      // =================================================

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
        ext === ".m3u8";

      const cacheControl =
        isPlaylist

          ? "no-cache, no-store, must-revalidate"

          : "public, max-age=3600, immutable";


      // =================================================
      // HEADERS
      // =================================================

      const headers = {

        "Content-Type":
          MIME_TYPES[ext],

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


      // =================================================
      // RESPONSE
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

      const stream =
        fs.createReadStream(
          filePath
        );


      stream.pipe(
        res
      );


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
// FFMPEG HEADERS
// =====================================================

const HTTP_HEADERS =
  "Origin: https://adarash.com\r\n" +
  "Referer: https://adarash.com/\r\n" +
  `Cookie: Cloud-CDN-Cookie=${cloudCdnCookie}\r\n`;


// =====================================================
// FFMPEG
// =====================================================

const ffmpegArgs = [

  // ===================================================
  // 240P INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_240P,


  // ===================================================
  // 360P INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_360P,


  // ===================================================
  // 720P INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_720P,


  // ===================================================
  // 1080P INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_1080P,


  // ===================================================
  // AUDIO INPUT
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_AUDIO,


  // ===================================================
  // 240P
  // ===================================================

  "-map",
  "0:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // 360P
  // ===================================================

  "-map",
  "1:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // 720P
  // ===================================================

  "-map",
  "2:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // 1080P
  // ===================================================

  "-map",
  "3:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // VIDEO
  // ===================================================

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
  // INIT FILE
  // ===================================================

  "-hls_fmp4_init_filename",
  "init.mp4",


  // ===================================================
  // SEGMENT FILES
  // ===================================================

  "-hls_segment_filename",

  path.join(
    OUTPUT_DIR,
    "%v",
    "segment-%06d.m4s"
  ),


  // ===================================================
  // VARIANT PLAYLISTS
  // ===================================================

  path.join(
    OUTPUT_DIR,
    "%v",
    "index.m3u8"
  ),

];


// =====================================================
// START FFMPEG
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
// SPAWN
// =====================================================

const ffmpeg =
  spawn(
    FFMPEG_PATH,
    ffmpegArgs,
    {
      stdio: [
        "ignore",
        "ignore",
        "pipe",
      ],
    }
  );


// =====================================================
// FFMPEG LOGGING
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

function shutdown(
  signal
) {

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