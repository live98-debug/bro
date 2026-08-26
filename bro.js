import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const PORT = 3000;

const OUTPUT_DIR = path.resolve("./output");

// =====================================================
// SOURCE URLS
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

const BROWSER_COOKIE = "_tt_enable_cookie=1; _ttp=01M0JRYNPSVWN2HBRWP1QAH4Z4_.tt.1; _gcl_au=1.1.1377455483.1787336546.-.-.1787337020.1419343882.1787559706.1787567297; Cloud-CDN-Cookie=URLPrefix=aHR0cHM6Ly9tZWRpYS5hZGFyYXNoLmNvbS9ldi1ldGZjLTAwMi1hZHdhLWZpZ2h0LW5pZ2h0LWpvaG55LWppdHMtMWVpZTZ6Lw:Expires=1787772378:KeyName=adarash-cdn-key:Signature=mDsvsTl1Zbc2TM3gVMNG7hLL1uw; ttcsid=1787747789445::-vR-jvve-Dck4U9JpEbP.12.1787753154361.0::1.2987361.2988583::5364911.21.243.543::5316454.1341.0; ttcsid_DA250UBC77UE58FDHF70=1787747792560::ZhxI2zZ9M8dsovrmYdbC.2.1787753154361.1"

if (!BROWSER_COOKIE) {
  console.error("");
  console.error(
    "ERROR: BROWSER_COOKIE environment variable is missing."
  );
  console.error("");
  console.error(
    "Example:"
  );
  console.error(
    "BROWSER_COOKIE='your-cookie' npm start"
  );
  console.error("");

  process.exit(1);
}


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


const cloudCdnCookie =
  extractCloudCookie(BROWSER_COOKIE);


// =====================================================
// OUTPUT DIRECTORY
// =====================================================

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);


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

const server = http.createServer(
  (req, res) => {

    // -----------------------------------------------
    // CORS OPTIONS
    // -----------------------------------------------

    if (req.method === "OPTIONS") {

      res.writeHead(
        204,
        {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET,HEAD,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        }
      );

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

      res.writeHead(405);

      res.end(
        "Method Not Allowed"
      );

      return;
    }


    // -----------------------------------------------
    // URL
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

      res.writeHead(400);

      res.end(
        "Bad Request"
      );

      return;
    }


    // -----------------------------------------------
    // TESTSTREAM.M3U8
    // -----------------------------------------------

    let relativePath;

    if (
      pathname ===
      "/teststream.m3u8"
    ) {

      relativePath =
        "teststream.m3u8";

    } else {

      relativePath =
        pathname.replace(
          /^\/+/,
          ""
        );

    }


    // -----------------------------------------------
    // SECURITY
    // -----------------------------------------------

    if (
      relativePath.includes("..") ||
      relativePath.includes("\\")
    ) {

      res.writeHead(400);

      res.end(
        "Invalid path"
      );

      return;
    }


    // -----------------------------------------------
    // RESOLVE FILE
    // -----------------------------------------------

    const filePath =
      path.resolve(
        OUTPUT_DIR,
        relativePath
      );


    // -----------------------------------------------
    // PREVENT PATH ESCAPE
    // -----------------------------------------------

    if (
      filePath !== OUTPUT_DIR &&
      !filePath.startsWith(
        OUTPUT_DIR + path.sep
      )
    ) {

      res.writeHead(400);

      res.end(
        "Invalid path"
      );

      return;
    }


    // -----------------------------------------------
    // EXTENSION
    // -----------------------------------------------

    const ext =
      path.extname(
        filePath
      ).toLowerCase();


    if (!MIME_TYPES[ext]) {

      res.writeHead(404);

      res.end(
        "Not Found"
      );

      return;
    }


    // -----------------------------------------------
    // FILE EXISTS?
    // -----------------------------------------------

    if (!fs.existsSync(filePath)) {

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


    const stat =
      fs.statSync(
        filePath
      );


    // -----------------------------------------------
    // CACHE
    // -----------------------------------------------

    const isPlaylist =
      ext === ".m3u8";


    let cacheControl;

    if (isPlaylist) {

      // Live playlists must refresh.
      cacheControl =
        "no-cache, no-store, must-revalidate";

    } else {

      // Media segments are immutable once created.
      cacheControl =
        "public, max-age=3600, immutable";

    }


    // -----------------------------------------------
    // RESPONSE HEADERS
    // -----------------------------------------------

    res.writeHead(
      200,
      {

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

      }
    );


    // -----------------------------------------------
    // HEAD
    // -----------------------------------------------

    if (
      req.method === "HEAD"
    ) {

      res.end();

      return;
    }


    // -----------------------------------------------
    // STREAM FILE
    // -----------------------------------------------

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
          "HLS file error:",
          error
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
// FFMPEG HTTP HEADERS
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
  // INPUT 0 - 240P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_240P,


  // ===================================================
  // INPUT 1 - 360P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_360P,


  // ===================================================
  // INPUT 2 - 720P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_720P,


  // ===================================================
  // INPUT 3 - 1080P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_1080P,


  // ===================================================
  // INPUT 4 - AUDIO
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCE_AUDIO,


  // ===================================================
  // 240P VIDEO + AUDIO
  // ===================================================

  "-map",
  "0:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // 360P VIDEO + AUDIO
  // ===================================================

  "-map",
  "1:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // 720P VIDEO + AUDIO
  // ===================================================

  "-map",
  "2:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // 1080P VIDEO + AUDIO
  // ===================================================

  "-map",
  "3:v:0",

  "-map",
  "4:a:0",


  // ===================================================
  // VIDEO
  // ===================================================

  // The source already contains
  // 240p / 360p / 720p / 1080p.
  //
  // Do NOT encode them again.

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
  // VARIANT NAMES
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
  ),

];


// =====================================================
// START
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
  `Output: http://localhost:${PORT}/teststream.m3u8`
);

console.log("");


// =====================================================
// START FFMPEG ONCE
// =====================================================

const ffmpeg =
  spawn(
    "ffmpeg",
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
// FFMPEG LOG
// =====================================================

ffmpeg.stderr.on(
  "data",
  (data) => {

    process.stderr.write(
      data
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
      "FFmpeg failed:"
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
// HTTP SERVER
// =====================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `HTTP server listening on port ${PORT}`
    );

    console.log("");

    console.log(
      "Master HLS:"
    );

    console.log(
      `http://localhost:${PORT}/teststream.m3u8`
    );

    console.log("");

  }
);


// =====================================================
// SHUTDOWN
// =====================================================

function shutdown() {

  console.log("");

  console.log(
    "Stopping restream..."
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

      process.exit(
        0
      );

    }
  );

}


process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);