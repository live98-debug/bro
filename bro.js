import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
  console.error("ERROR: stream-config.json not found");
  process.exit(1);
}

let config;

try {
  config = JSON.parse(
    fs.readFileSync(CONFIG_FILE, "utf8")
  );
} catch (error) {
  console.error("ERROR: Invalid stream-config.json");
  console.error(error.message);
  process.exit(1);
}

// =====================================================
// VALIDATION
// =====================================================

const requiredSources = [
  "360p",
  "720p",
  "audio"
];

for (const source of requiredSources) {
  if (
    typeof config.sources?.[source] !== "string" ||
    !config.sources[source]
  ) {
    console.error(
      `ERROR: sources.${source} is missing`
    );

    process.exit(1);
  }
}

if (
  !config.headers ||
  typeof config.headers.origin !== "string" ||
  typeof config.headers.referer !== "string"
) {
  console.error(
    "ERROR: headers.origin or headers.referer is missing"
  );

  process.exit(1);
}

if (
  typeof config.cookie !== "string" ||
  !config.cookie
) {
  console.error(
    "ERROR: cookie is missing"
  );

  process.exit(1);
}

// =====================================================
// SETTINGS
// =====================================================

const PORT = Number(config.port || 4060);

const FFMPEG =
  config.ffmpegPath || "/usr/bin/ffmpeg";

const SOURCES = config.sources;

// =====================================================
// OUTPUT DIRECTORIES
// =====================================================

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true
  }
);

for (const quality of ["360p", "720p"]) {

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
// CLEAN OLD HLS FILES
// =====================================================

function cleanDirectory(directory) {

  if (!fs.existsSync(directory)) {
    return;
  }

  for (const file of fs.readdirSync(directory)) {

    try {

      fs.unlinkSync(
        path.join(
          directory,
          file
        )
      );

    } catch {
      // Ignore
    }
  }
}

cleanDirectory(
  path.join(
    OUTPUT_DIR,
    "360p"
  )
);

cleanDirectory(
  path.join(
    OUTPUT_DIR,
    "720p"
  )
);

try {

  const master =
    path.join(
      OUTPUT_DIR,
      "teststream.m3u8"
    );

  if (fs.existsSync(master)) {
    fs.unlinkSync(master);
  }

} catch {
  // Ignore
}

// =====================================================
// SOURCE HTTP HEADERS
// =====================================================

const HTTP_HEADERS =
  `Origin: ${config.headers.origin}\r\n` +
  `Referer: ${config.headers.referer}\r\n` +
  `Cookie: ${config.cookie}\r\n`;

// =====================================================
// FFMPEG ARGUMENTS
// =====================================================
//
// Only 3 upstream connections:
//
// 360p
// 720p
// audio
//
// Video is copied without re-encoding.
// This keeps CPU usage low.
// =====================================================

const ffmpegArgs = [

  // ===================================================
  // 360P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["360p"],

  // ===================================================
  // 720P
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["720p"],

  // ===================================================
  // AUDIO
  // ===================================================

  "-headers",
  HTTP_HEADERS,

  "-i",
  SOURCES["audio"],

  // ===================================================
  // MAP 360P
  // ===================================================

  "-map",
  "0:v:0",

  "-map",
  "2:a:0",

  // ===================================================
  // MAP 720P
  // ===================================================

  "-map",
  "1:v:0",

  "-map",
  "2:a:0",

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

  // 2 second segments reduce latency.
  "-hls_time",
  "2",

  // Keep 6 segments.
  // ~12 seconds of playlist.
  "-hls_list_size",
  "6",

  // Keep a couple of old segments around.
  // This helps slower clients avoid 404s.
  "-hls_delete_threshold",
  "2",

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
  "v:0,a:0,name:360p " +
  "v:1,a:1,name:720p",

  // ===================================================
  // FMP4 INIT FILES
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
  )
];

// =====================================================
// LOG
// =====================================================

console.log("");
console.log("========================================");
console.log("       HLS RESTREAM - PRODUCTION");
console.log("========================================");
console.log("");

console.log(
  `FFmpeg: ${FFMPEG}`
);

console.log(
  "360p  -> source 360p"
);

console.log(
  "720p  -> source 720p"
);

console.log(
  "Audio -> shared audio source"
);

console.log("");

console.log(
  "Video: COPY (no transcoding)"
);

console.log(
  "HLS: 2 second segments"
);

console.log(
  "Playlist: 6 segments"
);

console.log("");

console.log(
  `Master: http://127.0.0.1:${PORT}/teststream.m3u8`
);

console.log("");

// =====================================================
// START FFMPEG
// =====================================================

let ffmpeg;

try {

  ffmpeg = spawn(
    FFMPEG,
    ffmpegArgs,
    {
      stdio: [
        "ignore",
        "ignore",
        "pipe"
      ]
    }
  );

} catch (error) {

  console.error(
    "Failed to start FFmpeg:"
  );

  console.error(error);

  process.exit(1);
}

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
      "FFMPEG ERROR"
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
// SHUTDOWN
// =====================================================

let shuttingDown = false;

function shutdown(signal) {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

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

  setTimeout(
    () => {
      process.exit(0);
    },
    6000
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