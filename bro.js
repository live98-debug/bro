// import http from "node:http";
// import https from "node:https";
// import fs from "node:fs";
// import path from "node:path";
// import { URL } from "node:url";
// import { fileURLToPath } from "node:url";


// // ==================================================
// // CONFIG
// // ==================================================

// const PORT = 4060;

// const SOURCE = "https://img.refooty.com/m3u8/Real_Madrid_v_Real_Sociedad_2026_08_26.m3u8";

// const STREAM_LINK = "https://stream.dashsh.bet/index.m3u8";


// // ==================================================
// // PHONE / AMOUNT
// // ==================================================

// const PHONE = [
//   "0993420439"
// ];

// const AMOUNT = 100;


// // ==================================================
// // PATHS
// // ==================================================

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const TRANSACTION_FILE = path.join(
//   __dirname,
//   "transaction.json"
// );


// // ==================================================
// // TRANSACTION FILE
// // ==================================================

// function ensureTransactionFile() {
//   if (!fs.existsSync(TRANSACTION_FILE)) {
//     fs.writeFileSync(
//       TRANSACTION_FILE,
//       "[]",
//       "utf8"
//     );
//   }
// }

// ensureTransactionFile();


// function readTransactions() {
//   try {
//     const data = fs.readFileSync(
//       TRANSACTION_FILE,
//       "utf8"
//     );

//     if (!data.trim()) {
//       return [];
//     }

//     const transactions = JSON.parse(data);

//     if (!Array.isArray(transactions)) {
//       throw new Error(
//         "transaction.json must contain an array"
//       );
//     }

//     return transactions;

//   } catch (error) {

//     console.error(
//       "Failed to read transaction.json:",
//       error.message
//     );

//     return [];
//   }
// }


// function writeTransactions(transactions) {
//   const tempFile =
//     `${TRANSACTION_FILE}.tmp`;

//   fs.writeFileSync(
//     tempFile,
//     JSON.stringify(
//       transactions,
//       null,
//       2
//     ),
//     "utf8"
//   );

//   // Atomic replacement
//   fs.renameSync(
//     tempFile,
//     TRANSACTION_FILE
//   );
// }


// // ==================================================
// // TRANSACTION LOCK
// // ==================================================
// //
// // Prevents two POST requests arriving at exactly
// // the same time from both inserting the same trx.
// //

// let transactionLock =
//   Promise.resolve();


// function withTransactionLock(fn) {

//   const next =
//     transactionLock.then(fn);

//   transactionLock =
//     next.catch(() => {});

//   return next;
// }


// // ==================================================
// // JSON RESPONSE
// // ==================================================

// function sendJson(
//   res,
//   status,
//   data
// ) {

//   const body =
//     JSON.stringify(data);

//   res.writeHead(
//     status,
//     {
//       "Content-Type":
//         "application/json; charset=utf-8",

//       "Content-Length":
//         Buffer.byteLength(body),

//       "Cache-Control":
//         "no-store",

//       "Access-Control-Allow-Origin":
//         "*",

//       "Access-Control-Allow-Methods":
//         "GET, POST, HEAD, OPTIONS",

//       "Access-Control-Allow-Headers":
//         "*",
//     }
//   );

//   res.end(body);
// }


// // ==================================================
// // READ REQUEST BODY
// // ==================================================

// function readBody(req) {

//   return new Promise(
//     (resolve, reject) => {

//       let body = "";

//       let size = 0;

//       const MAX_BODY_SIZE =
//         1024 * 1024;


//       req.on(
//         "data",
//         (chunk) => {

//           size += chunk.length;

//           if (
//             size >
//             MAX_BODY_SIZE
//           ) {

//             reject(
//               new Error(
//                 "Request body too large"
//               )
//             );

//             req.destroy();

//             return;
//           }

//           body += chunk.toString();
//         }
//       );


//       req.on(
//         "end",
//         () => {
//           resolve(body);
//         }
//       );


//       req.on(
//         "error",
//         reject
//       );
//     }
//   );
// }


// // ==================================================
// // GET TRANSACTION INFO
// // ==================================================

// function handleGetTransaction(
//   req,
//   res
// ) {

//   if (
//     PHONE.length === 0
//   ) {

//     return sendJson(
//       res,
//       500,
//       {
//         error:
//           "PHONE array is empty"
//       }
//     );
//   }


//   // Random phone from PHONE array
//   const phone =
//     PHONE[
//       Math.floor(
//         Math.random() *
//         PHONE.length
//       )
//     ];


//   return sendJson(
//     res,
//     200,
//     {
//       phone,
//       amount: AMOUNT
//     }
//   );
// }


// // ==================================================
// // POST TRANSACTION
// // ==================================================

// async function handlePostTransaction(
//   req,
//   res
// ) {

//   let body;

//   try {

//     body =
//       await readBody(req);

//   } catch (error) {

//     return sendJson(
//       res,
//       400,
//       {
//         error:
//           error.message
//       }
//     );
//   }


//   let data;

//   try {

//     data =
//       JSON.parse(body);

//   } catch {

//     return sendJson(
//       res,
//       400,
//       {
//         error:
//           "Invalid JSON"
//       }
//     );
//   }


//   const trx =
//     typeof data.trx === "string"
//       ? data.trx.trim()
//       : "";


//   const phone =
//     typeof data.phone === "string"
//       ? data.phone.trim()
//       : "";


//   if (!trx) {

//     return sendJson(
//       res,
//       400,
//       {
//         error:
//           "trx is required"
//       }
//     );
//   }


//   if (!phone) {

//     return sendJson(
//       res,
//       400,
//       {
//         error:
//           "phone is required"
//       }
//     );
//   }


//   // ==================================================
//   // SAVE TRANSACTION
//   // ==================================================

//   try {

//     const result =
//       await withTransactionLock(
//         async () => {

//           const transactions =
//             readTransactions();


//           // ------------------------------------------
//           // DUPLICATE CHECK
//           // ------------------------------------------

//           const existing =
//             transactions.find(
//               (transaction) =>
//                 transaction.trx === trx
//             );


//           if (existing) {

//             return {
//               duplicate: true
//             };
//           }


//           // ------------------------------------------
//           // NEW TRANSACTION
//           // ------------------------------------------

//           const transaction = {
//             trx,
//             phone,
//             amount: AMOUNT,
//             createdAt:
//               new Date().toISOString()
//           };


//           transactions.push(
//             transaction
//           );


//           writeTransactions(
//             transactions
//           );


//           console.log(
//             "Transaction saved:",
//             transaction
//           );


//           return {
//             duplicate: false,
//             transaction
//           };
//         }
//       );


//     // ==================================================
//     // DUPLICATE
//     // ==================================================

//     if (
//       result.duplicate
//     ) {

//       return sendJson(
//         res,
//         409,
//         {
//           error:
//             "Transaction already exists",
//           trx
//         }
//       );
//     }


//     // ==================================================
//     // SUCCESS
//     // ==================================================

//     return sendJson(
//       res,
//       200,
//       {
//         success: true,

//         trx,

//         phone,

//         stream:
//           STREAM_LINK
//       }
//     );


//   } catch (error) {

//     console.error(
//       "Transaction save error:",
//       error
//     );

//     return sendJson(
//       res,
//       500,
//       {
//         error:
//           "Failed to save transaction"
//       }
//     );
//   }
// }


// // ==================================================
// // HLS HTTP SERVER
// // ==================================================

// const server =
//   http.createServer(
//     async (req, res) => {

//       // ==================================================
//       // CORS
//       // ==================================================

//       res.setHeader(
//         "Access-Control-Allow-Origin",
//         "*"
//       );

//       res.setHeader(
//         "Access-Control-Allow-Methods",
//         "GET, POST, HEAD, OPTIONS"
//       );

//       res.setHeader(
//         "Access-Control-Allow-Headers",
//         "*"
//       );


//       if (
//         req.method === "OPTIONS"
//       ) {

//         res.writeHead(204);

//         return res.end();
//       }


//       // ==================================================
//       // URL
//       // ==================================================

//       let requestUrl;

//       try {

//         requestUrl =
//           new URL(
//             req.url,
//             `http://${req.headers.host}`
//           );

//       } catch {

//         return sendJson(
//           res,
//           400,
//           {
//             error:
//               "Invalid URL"
//           }
//         );
//       }


//       // ==================================================
//       // GET TRANSACTION
//       // ==================================================

//       if (
//         requestUrl.pathname ===
//           "/api/transaction" &&
//         req.method === "GET"
//       ) {

//         return handleGetTransaction(
//           req,
//           res
//         );
//       }


//       // ==================================================
//       // POST TRANSACTION
//       // ==================================================

//       if (
//         requestUrl.pathname ===
//           "/api/transaction" &&
//         req.method === "POST"
//       ) {

//         return handlePostTransaction(
//           req,
//           res
//         );
//       }


//       // ==================================================
//       // HLS MASTER PLAYLIST
//       // ==================================================

//       if (
//         requestUrl.pathname ===
//           "/index.m3u8"
//       ) {

//         if (
//           req.method !== "GET" &&
//           req.method !== "HEAD"
//         ) {

//           res.writeHead(405);

//           return res.end(
//             "Method Not Allowed"
//           );
//         }


//         try {

//           const playlist =
//             await fetchText(
//               SOURCE
//             );


//           const sourceUrl =
//             new URL(SOURCE);


//           const rewritten =
//             playlist
//               .split("\n")
//               .map((line) => {

//                 const trimmed =
//                   line.trim();


//                 if (
//                   !trimmed ||
//                   trimmed.startsWith("#")
//                 ) {

//                   return line;
//                 }


//                 const absolute =
//                   new URL(
//                     trimmed,
//                     sourceUrl
//                   );


//                 return `/proxy?url=${encodeURIComponent(
//                   absolute.href
//                 )}`;
//               })
//               .join("\n");


//           res.writeHead(
//             200,
//             {
//               "Content-Type":
//                 "application/vnd.apple.mpegurl",

//               "Cache-Control":
//                 "no-cache, no-store, must-revalidate",
//             }
//           );


//           if (
//             req.method === "HEAD"
//           ) {

//             return res.end();
//           }


//           return res.end(
//             rewritten
//           );


//         } catch (error) {

//           console.error(
//             "Playlist error:",
//             error
//           );


//           res.writeHead(502);

//           return res.end(
//             "Unable to fetch source playlist"
//           );
//         }
//       }


//       // ==================================================
//       // HLS PROXY
//       // ==================================================

//       if (
//         requestUrl.pathname ===
//           "/proxy"
//       ) {

//         const target =
//           requestUrl.searchParams.get(
//             "url"
//           );


//         if (!target) {

//           res.writeHead(400);

//           return res.end(
//             "Missing url"
//           );
//         }


//         let targetUrl;

//         try {

//           targetUrl =
//             new URL(target);

//         } catch {

//           res.writeHead(400);

//           return res.end(
//             "Invalid URL"
//           );
//         }


//         if (
//           targetUrl.protocol !==
//           "https:"
//         ) {

//           res.writeHead(400);

//           return res.end(
//             "Only HTTPS sources are allowed"
//           );
//         }


//         try {

//           return proxyRequest(
//             targetUrl,
//             req,
//             res
//           );

//         } catch (error) {

//           console.error(
//             "Proxy error:",
//             error
//           );


//           if (
//             !res.headersSent
//           ) {

//             res.writeHead(502);
//           }


//           res.end(
//             "Proxy error"
//           );
//         }
//       }


//       // ==================================================
//       // 404
//       // ==================================================

//       res.writeHead(404);

//       res.end(
//         "Not found"
//       );
//     }
//   );


// // ==================================================
// // FETCH TEXT
// // ==================================================

// function fetchText(url) {

//   return new Promise(
//     (resolve, reject) => {

//       const client =
//         url.startsWith("https:")
//           ? https
//           : http;


//       const request =
//         client.get(
//           url,
//           {
//             headers: {
//               "User-Agent":
//                 "Mozilla/5.0",

//               "Accept":
//                 "*/*",
//             },
//           },

//           (response) => {

//             if (
//               response.statusCode < 200 ||
//               response.statusCode >= 300
//             ) {

//               response.resume();


//               return reject(
//                 new Error(
//                   `Source returned HTTP ${response.statusCode}`
//                 )
//               );
//             }


//             let body = "";


//             response.setEncoding(
//               "utf8"
//             );


//             response.on(
//               "data",
//               (chunk) => {
//                 body += chunk;
//               }
//             );


//             response.on(
//               "end",
//               () => {
//                 resolve(body);
//               }
//             );
//           }
//         );


//       request.setTimeout(
//         10000,
//         () => {

//           request.destroy(
//             new Error(
//               "Source request timeout"
//             )
//           );
//         }
//       );


//       request.on(
//         "error",
//         reject
//       );
//     }
//   );
// }


// // ==================================================
// // STREAM PROXY
// // ==================================================

// function proxyRequest(
//   targetUrl,
//   req,
//   res
// ) {

//   return new Promise(
//     (resolve, reject) => {

//       const client =
//         targetUrl.protocol ===
//         "https:"
//           ? https
//           : http;


//       const proxy =
//         client.get(
//           targetUrl,
//           {
//             headers: {

//               "User-Agent":
//                 req.headers["user-agent"] ||
//                 "Mozilla/5.0",

//               "Accept":
//                 req.headers.accept ||
//                 "*/*",

//               "Referer":
//                 req.headers.referer ||
//                 "",

//               "Origin":
//                 req.headers.origin ||
//                 "",
//             },
//           },

//           (response) => {

//             if (
//               response.statusCode < 200 ||
//               response.statusCode >= 300
//             ) {

//               response.resume();


//               if (
//                 !res.headersSent
//               ) {

//                 res.writeHead(
//                   response.statusCode ||
//                     502
//                 );
//               }


//               res.end();

//               return resolve();
//             }


//             const contentType =
//               response.headers[
//                 "content-type"
//               ] || "";


//             const isPlaylist =
//               targetUrl.pathname.endsWith(
//                 ".m3u8"
//               ) ||
//               contentType.includes(
//                 "application/vnd.apple.mpegurl"
//               ) ||
//               contentType.includes(
//                 "application/x-mpegURL"
//               );


//             // ==========================================
//             // NESTED PLAYLIST
//             // ==========================================

//             if (isPlaylist) {

//               let body = "";


//               response.setEncoding(
//                 "utf8"
//               );


//               response.on(
//                 "data",
//                 (chunk) => {
//                   body += chunk;
//                 }
//               );


//               response.on(
//                 "end",
//                 () => {

//                   const rewritten =
//                     body
//                       .split("\n")
//                       .map((line) => {

//                         const trimmed =
//                           line.trim();


//                         if (
//                           !trimmed ||
//                           trimmed.startsWith("#")
//                         ) {

//                           return line;
//                         }


//                         const absolute =
//                           new URL(
//                             trimmed,
//                             targetUrl
//                           );


//                         return `/proxy?url=${encodeURIComponent(
//                           absolute.href
//                         )}`;
//                       })
//                       .join("\n");


//                   res.writeHead(
//                     200,
//                     {
//                       "Content-Type":
//                         "application/vnd.apple.mpegurl",

//                       "Cache-Control":
//                         "no-cache, no-store, must-revalidate",
//                     }
//                   );


//                   if (
//                     req.method === "HEAD"
//                   ) {

//                     return res.end();
//                   }


//                   res.end(
//                     rewritten
//                   );


//                   resolve();
//                 }
//               );


//               return;
//             }


//             // ==========================================
//             // VIDEO / AUDIO SEGMENT
//             // ==========================================

//             const headers = {

//               "Content-Type":
//                 contentType ||
//                 "application/octet-stream",

//               "Cache-Control":
//                 "public, max-age=3600, immutable",
//             };


//             if (
//               response.headers[
//                 "content-length"
//               ]
//             ) {

//               headers[
//                 "Content-Length"
//               ] =
//                 response.headers[
//                   "content-length"
//                 ];
//             }


//             res.writeHead(
//               response.statusCode,
//               headers
//             );


//             if (
//               req.method === "HEAD"
//             ) {

//               response.resume();

//               res.end();

//               return resolve();
//             }


//             response.pipe(res);


//             response.on(
//               "end",
//               resolve
//             );
//           }
//         );


//       proxy.setTimeout(
//         15000,
//         () => {

//           proxy.destroy(
//             new Error(
//               "Upstream timeout"
//             )
//           );
//         }
//       );


//       proxy.on(
//         "error",
//         reject
//       );


//       req.on(
//         "close",
//         () => {

//           if (
//             !res.writableEnded
//           ) {

//             proxy.destroy();
//           }
//         }
//       );
//     }
//   );
// }


// // ==================================================
// // START
// // ==================================================

// server.listen(
//   PORT,
//   "127.0.0.1",
//   () => {

//     console.log(
//       `HLS proxy running on http://127.0.0.1:${PORT}`
//     );

//     console.log(
//       `Playlist: http://127.0.0.1:${PORT}/index.m3u8`
//     );

//     console.log(
//       `GET: http://127.0.0.1:${PORT}/api/transaction`
//     );

//     console.log(
//       `POST: http://127.0.0.1:${PORT}/api/transaction`
//     );
//   }
// );


// // ==================================================
// // SHUTDOWN
// // ==================================================

// function shutdown() {

//   server.close(
//     () => {
//       process.exit(0);
//     }
//   );
// }


// process.on(
//   "SIGINT",
//   shutdown
// );

// process.on(
//   "SIGTERM",
//   shutdown
// );


import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

// =====================================================
// CONFIG
// =====================================================

const PORT = 4060;

// Separate HLS sources
const VIDEO_SOURCE =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-720p/index-1.m3u8";

const AUDIO_SOURCE =
  "https://media.adarash.com/ev-etfc-002-adwa-fight-night-johny-jits-1eie6z/20260824T065421Z/s-audio/index-1.m3u8";

// Same cookie for both sources
const SOURCE_COOKIE =
  "_tt_enable_cookie=1; _ttp=01M0JRYNPSVWN2HBRWP1QAH4Z4_.tt.1; _gcl_au=1.1.1377455483.1787336546.-.-.1787337020.2117025329.1787845656.1787845655; ttcsid_DA250UBC77UE58FDHF70=1787849251653::sD5JM_Pc2LlBXWRe79dr.10.1787849255360.1; Cloud-CDN-Cookie=URLPrefix=aHR0cHM6Ly9tZWRpYS5hZGFyYXNoLmNvbS9ldi1ldGZjLTAwMi1hZHdhLWZpZ2h0LW5pZ2h0LWpvaG55LWppdHMtMWVpZTZ6Lw:Expires=1787870856:KeyName=adarash-cdn-key:Signature=M_9Y1BM9cl0iNjxzqjsDJEF5-IA; ttcsid=1787849248360::JZDhb1nT3Ca7o23eVN8j.20.1787849255359.0::1.6768.3293::5897.3.400.448::1696106.1703.0";

// Public stream returned after successful transaction
const STREAM_LINK =
  "https://stream.dashsh.bet/index.m3u8";

// Payment configuration
const PHONE = [
  "0993420439"
];

const AMOUNT = 300;

// Transaction storage
const TRANSACTION_FILE =
  path.join(
    process.cwd(),
    "transaction.json"
  );


// =====================================================
// CONNECTION POOL
// =====================================================

const httpsAgent =
  new https.Agent({
    keepAlive: true,
    maxSockets: 200,
    maxFreeSockets: 50,
    keepAliveMsecs: 1000,
  });


// =====================================================
// TRANSACTION STORAGE
// =====================================================

function loadTransactions() {
  try {
    if (!fs.existsSync(TRANSACTION_FILE)) {
      return [];
    }

    const data =
      fs.readFileSync(
        TRANSACTION_FILE,
        "utf8"
      );

    if (!data.trim()) {
      return [];
    }

    const parsed =
      JSON.parse(data);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch (error) {
    console.error(
      "transaction.json read error:",
      error.message
    );

    return [];
  }
}


function saveTransactions(
  transactions
) {
  const tempFile =
    `${TRANSACTION_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      transactions,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    tempFile,
    TRANSACTION_FILE
  );
}


// =====================================================
// JSON RESPONSE
// =====================================================

function jsonResponse(
  res,
  status,
  data
) {
  const body =
    JSON.stringify(data);

  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(body),

      "Cache-Control":
        "no-store",

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Methods":
        "GET, POST, HEAD, OPTIONS",

      "Access-Control-Allow-Headers":
        "*",
    }
  );

  res.end(body);
}


// =====================================================
// READ REQUEST BODY
// =====================================================

function readBody(req) {
  return new Promise(
    (resolve, reject) => {
      let body = "";

      let size = 0;

      const MAX_SIZE =
        1024 * 1024;

      req.on(
        "data",
        (chunk) => {
          size += chunk.length;

          if (size > MAX_SIZE) {
            req.destroy();

            reject(
              new Error(
                "Request body too large"
              )
            );

            return;
          }

          body +=
            chunk.toString("utf8");
        }
      );

      req.on(
        "end",
        () => {
          resolve(body);
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}


// =====================================================
// PAYMENT GET
// =====================================================

function getPaymentInfo() {
  if (!PHONE.length) {
    throw new Error(
      "PHONE array is empty"
    );
  }

  const phone =
    PHONE[
      Math.floor(
        Math.random() *
        PHONE.length
      )
    ];

  return {
    phone,
    amount: AMOUNT,
  };
}


// =====================================================
// UPSTREAM HEADERS
// =====================================================

function getUpstreamHeaders(req) {
  const headers = {
    "User-Agent":
      req.headers["user-agent"] ||
      "Mozilla/5.0",

    "Accept":
      req.headers.accept ||
      "*/*",

    "Cookie":
      SOURCE_COOKIE,
  };

  if (req.headers.referer) {
    headers.Referer =
      req.headers.referer;
  }

  if (req.headers.origin) {
    headers.Origin =
      req.headers.origin;
  }

  return headers;
}


// =====================================================
// REWRITE HLS PLAYLIST
// =====================================================
//
// This is important.
//
// It rewrites:
//
//   segment.m4s
//
// AND:
//
//   #EXT-X-MAP:URI="init.m4s"
//
// AND:
//
//   #EXT-X-KEY:URI="key"
//
// AND nested playlists.
//
// =====================================================

function rewritePlaylist(
  playlist,
  baseUrl
) {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed =
        line.trim();

      if (!trimmed) {
        return line;
      }

      // -----------------------------------------------
      // HLS directives containing URI=""
      // -----------------------------------------------

      if (
        trimmed.startsWith("#")
      ) {
        return line.replace(
          /URI="([^"]+)"/g,
          (match, uri) => {
            try {
              const absolute =
                new URL(
                  uri,
                  baseUrl
                );

              const proxy =
                `/proxy?url=${encodeURIComponent(
                  absolute.href
                )}`;

              return `URI="${proxy}"`;
            } catch {
              return match;
            }
          }
        );
      }

      // -----------------------------------------------
      // Media segment / nested playlist
      // -----------------------------------------------

      try {
        const absolute =
          new URL(
            trimmed,
            baseUrl
          );

        return (
          `/proxy?url=${encodeURIComponent(
            absolute.href
          )}`
        );
      } catch {
        return line;
      }
    })
    .join("\n");
}


// =====================================================
// FETCH HLS PLAYLIST
// =====================================================

function fetchPlaylist(
  sourceUrl
) {
  return new Promise(
    (resolve, reject) => {
      let parsed;

      try {
        parsed =
          new URL(sourceUrl);
      } catch {
        reject(
          new Error(
            "Invalid source URL"
          )
        );

        return;
      }

      if (
        parsed.protocol !==
        "https:"
      ) {
        reject(
          new Error(
            "Only HTTPS sources are supported"
          )
        );

        return;
      }

      const request =
        https.get(
          parsed,
          {
            agent: httpsAgent,

            headers: {
              "User-Agent":
                "Mozilla/5.0",

              "Accept":
                "*/*",

              "Cookie":
                SOURCE_COOKIE,
            },
          },
          (response) => {
            const status =
              response.statusCode ||
              0;

            if (
              status < 200 ||
              status >= 300
            ) {
              response.resume();

              reject(
                new Error(
                  `Source returned HTTP ${status}`
                )
              );

              return;
            }

            let body = "";

            response.setEncoding(
              "utf8"
            );

            response.on(
              "data",
              (chunk) => {
                body += chunk;
              }
            );

            response.on(
              "end",
              () => {
                resolve(body);
              }
            );
          }
        );

      request.setTimeout(
        15000,
        () => {
          request.destroy(
            new Error(
              "Source timeout"
            )
          );
        }
      );

      request.on(
        "error",
        reject
      );
    }
  );
}


// =====================================================
// VIDEO PLAYLIST
// =====================================================

async function handleVideoPlaylist(
  req,
  res
) {
  try {
    const playlist =
      await fetchPlaylist(
        VIDEO_SOURCE
      );

    const rewritten =
      rewritePlaylist(
        playlist,
        VIDEO_SOURCE
      );

    const body =
      Buffer.from(
        rewritten,
        "utf8"
      );

    res.writeHead(
      200,
      {
        "Content-Type":
          "application/vnd.apple.mpegurl",

        "Content-Length":
          body.length,

        "Cache-Control":
          "no-cache, no-store, must-revalidate",

        "Access-Control-Allow-Origin":
          "*",
      }
    );

    if (
      req.method ===
      "HEAD"
    ) {
      return res.end();
    }

    res.end(body);
  } catch (error) {
    console.error(
      "Video playlist error:",
      error.message
    );

    res.writeHead(502);

    res.end(
      "Unable to fetch video playlist"
    );
  }
}


// =====================================================
// AUDIO PLAYLIST
// =====================================================

async function handleAudioPlaylist(
  req,
  res
) {
  try {
    const playlist =
      await fetchPlaylist(
        AUDIO_SOURCE
      );

    const rewritten =
      rewritePlaylist(
        playlist,
        AUDIO_SOURCE
      );

    const body =
      Buffer.from(
        rewritten,
        "utf8"
      );

    res.writeHead(
      200,
      {
        "Content-Type":
          "application/vnd.apple.mpegurl",

        "Content-Length":
          body.length,

        "Cache-Control":
          "no-cache, no-store, must-revalidate",

        "Access-Control-Allow-Origin":
          "*",
      }
    );

    if (
      req.method ===
      "HEAD"
    ) {
      return res.end();
    }

    res.end(body);
  } catch (error) {
    console.error(
      "Audio playlist error:",
      error.message
    );

    res.writeHead(502);

    res.end(
      "Unable to fetch audio playlist"
    );
  }
}


// =====================================================
// MASTER PLAYLIST
// =====================================================
//
// The player gets:
//
//   video playlist
//        +
//   audio playlist
//
// =====================================================

function handleMasterPlaylist(
  req,
  res
) {
  const playlist = [
    "#EXTM3U",

    "#EXT-X-VERSION:7",

    "",
    
    "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"English\",DEFAULT=YES,AUTOSELECT=YES,URI=\"/audio.m3u8\"",

    "",

    "#EXT-X-STREAM-INF:BANDWIDTH=2500000,AVERAGE-BANDWIDTH=2000000,RESOLUTION=1920x1080,CODECS=\"avc1.640028,mp4a.40.2\",AUDIO=\"audio\"",

    "/video.m3u8",

  ].join("\n");

  const body =
    Buffer.from(
      playlist,
      "utf8"
    );

  res.writeHead(
    200,
    {
      "Content-Type":
        "application/vnd.apple.mpegurl",

      "Content-Length":
        body.length,

      "Cache-Control":
        "no-cache, no-store, must-revalidate",

      "Access-Control-Allow-Origin":
        "*",
    }
  );

  if (
    req.method ===
    "HEAD"
  ) {
    return res.end();
  }

  res.end(body);
}


// =====================================================
// PROXY MEDIA / NESTED PLAYLIST
// =====================================================

function proxyRequest(
  targetUrl,
  req,
  res
) {
  return new Promise(
    (resolve, reject) => {
      const client =
        targetUrl.protocol ===
        "https:"
          ? https
          : http;

      const request =
        client.get(
          targetUrl,
          {
            agent:
              targetUrl.protocol ===
              "https:"
                ? httpsAgent
                : undefined,

            headers:
              getUpstreamHeaders(req),
          },

          (response) => {
            const status =
              response.statusCode ||
              502;

            if (
              status < 200 ||
              status >= 300
            ) {
              response.resume();

              if (
                !res.headersSent
              ) {
                res.writeHead(
                  status
                );
              }

              res.end();

              resolve();

              return;
            }

            const contentType =
              response.headers[
                "content-type"
              ] || "";

            const pathname =
              targetUrl.pathname
                .toLowerCase();

            // -----------------------------------------
            // Is this an HLS playlist?
            // -----------------------------------------

            const isPlaylist =
              pathname.endsWith(
                ".m3u8"
              ) ||
              contentType.includes(
                "application/vnd.apple.mpegurl"
              ) ||
              contentType.includes(
                "application/x-mpegurl"
              );

            // -----------------------------------------
            // PLAYLIST
            // -----------------------------------------

            if (isPlaylist) {
              let body = "";

              response.setEncoding(
                "utf8"
              );

              response.on(
                "data",
                (chunk) => {
                  body += chunk;
                }
              );

              response.on(
                "end",
                () => {
                  const rewritten =
                    rewritePlaylist(
                      body,
                      targetUrl.href
                    );

                  const output =
                    Buffer.from(
                      rewritten,
                      "utf8"
                    );

                  res.writeHead(
                    200,
                    {
                      "Content-Type":
                        "application/vnd.apple.mpegurl",

                      "Content-Length":
                        output.length,

                      "Cache-Control":
                        "no-cache, no-store, must-revalidate",

                      "Access-Control-Allow-Origin":
                        "*",

                      "Access-Control-Allow-Methods":
                        "GET, HEAD, OPTIONS",

                      "Access-Control-Allow-Headers":
                        "*",
                    }
                  );

                  if (
                    req.method ===
                    "HEAD"
                  ) {
                    res.end();

                    resolve();

                    return;
                  }

                  res.end(output);

                  resolve();
                }
              );

              return;
            }

            // -----------------------------------------
            // MEDIA SEGMENT
            // -----------------------------------------

            const headers = {
              "Content-Type":
                contentType ||
                "application/octet-stream",

              "Cache-Control":
                "public, max-age=3600, immutable",

              "Access-Control-Allow-Origin":
                "*",

              "Access-Control-Allow-Methods":
                "GET, HEAD, OPTIONS",

              "Access-Control-Allow-Headers":
                "*",
            };

            if (
              response.headers[
                "content-length"
              ]
            ) {
              headers[
                "Content-Length"
              ] =
                response.headers[
                  "content-length"
                ];
            }

            if (
              response.headers[
                "accept-ranges"
              ]
            ) {
              headers[
                "Accept-Ranges"
              ] =
                response.headers[
                  "accept-ranges"
                ];
            }

            res.writeHead(
              status,
              headers
            );

            if (
              req.method ===
              "HEAD"
            ) {
              response.resume();

              res.end();

              resolve();

              return;
            }

            response.pipe(res);

            response.on(
              "end",
              resolve
            );

            response.on(
              "error",
              reject
            );
          }
        );

      request.setTimeout(
        20000,
        () => {
          request.destroy(
            new Error(
              "Upstream timeout"
            )
          );
        }
      );

      request.on(
        "error",
        reject
      );

      req.on(
        "close",
        () => {
          if (
            !res.writableEnded
          ) {
            request.destroy();
          }
        }
      );
    }
  );
}


// =====================================================
// HTTP SERVER
// =====================================================

const server =
  http.createServer(
    async (req, res) => {

      // ===============================================
      // CORS
      // ===============================================

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, HEAD, OPTIONS"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "*"
      );


      // ===============================================
      // OPTIONS
      // ===============================================

      if (
        req.method ===
        "OPTIONS"
      ) {
        res.writeHead(204);

        return res.end();
      }


      // ===============================================
      // URL
      // ===============================================

      let requestUrl;

      try {
        requestUrl =
          new URL(
            req.url,
            `http://${req.headers.host}`
          );
      } catch {
        return jsonResponse(
          res,
          400,
          {
            error:
              "Invalid URL",
          }
        );
      }


      // ===============================================
      // GET /payment
      // ===============================================

      if (
        requestUrl.pathname ===
          "/payment" &&
        req.method ===
          "GET"
      ) {
        try {
          const payment =
            getPaymentInfo();

          return jsonResponse(
            res,
            200,
            payment
          );
        } catch (error) {
          return jsonResponse(
            res,
            500,
            {
              error:
                error.message,
            }
          );
        }
      }


      // ===============================================
      // POST /transaction
      // ===============================================

      if (
        requestUrl.pathname ===
          "/transaction" &&
        req.method ===
          "POST"
      ) {
        try {
          const rawBody =
            await readBody(req);

          let body;

          try {
            body =
              JSON.parse(rawBody);
          } catch {
            return jsonResponse(
              res,
              400,
              {
                error:
                  "Body must be valid JSON",
              }
            );
          }

          const trx =
            typeof body.trx ===
            "string"
              ? body.trx.trim()
              : "";

          const phone =
            typeof body.phone ===
            "string"
              ? body.phone.trim()
              : "";

          if (!trx) {
            return jsonResponse(
              res,
              400,
              {
                error:
                  "trx is required",
              }
            );
          }

          if (!phone) {
            return jsonResponse(
              res,
              400,
              {
                error:
                  "phone is required",
              }
            );
          }


          // -------------------------------------------
          // Load transactions
          // -------------------------------------------

          const transactions =
            loadTransactions();


          // -------------------------------------------
          // Check duplicate TRX
          // -------------------------------------------

          const exists =
            transactions.some(
              (item) =>
                item.trx === trx
            );

          if (exists) {
            return jsonResponse(
              res,
              409,
              {
                error:
                  "Transaction already exists",
              }
            );
          }


          // -------------------------------------------
          // Save
          // -------------------------------------------

          const transaction = {
            trx,
            phone,
            createdAt:
              new Date().toISOString(),
          };

          transactions.push(
            transaction
          );

          saveTransactions(
            transactions
          );

          console.log(
            "Transaction saved:",
            transaction
          );


          // -------------------------------------------
          // Return stream
          // -------------------------------------------

          return jsonResponse(
            res,
            200,
            {
              success: true,

              stream:
                STREAM_LINK,
            }
          );

        } catch (error) {
          console.error(
            "Transaction error:",
            error
          );

          return jsonResponse(
            res,
            500,
            {
              error:
                "Unable to save transaction",
            }
          );
        }
      }


      // ===============================================
      // MASTER PLAYLIST
      // ===============================================

      if (
        requestUrl.pathname ===
          "/index.m3u8" &&
        (
          req.method ===
            "GET" ||
          req.method ===
            "HEAD"
        )
      ) {
        return handleMasterPlaylist(
          req,
          res
        );
      }


      // ===============================================
      // VIDEO PLAYLIST
      // ===============================================

      if (
        requestUrl.pathname ===
          "/video.m3u8" &&
        (
          req.method ===
            "GET" ||
          req.method ===
            "HEAD"
        )
      ) {
        return handleVideoPlaylist(
          req,
          res
        );
      }


      // ===============================================
      // AUDIO PLAYLIST
      // ===============================================

      if (
        requestUrl.pathname ===
          "/audio.m3u8" &&
        (
          req.method ===
            "GET" ||
          req.method ===
            "HEAD"
        )
      ) {
        return handleAudioPlaylist(
          req,
          res
        );
      }


      // ===============================================
      // PROXY
      // ===============================================

      if (
        requestUrl.pathname ===
          "/proxy" &&
        (
          req.method ===
            "GET" ||
          req.method ===
            "HEAD"
        )
      ) {
        const target =
          requestUrl.searchParams.get(
            "url"
          );

        if (!target) {
          return jsonResponse(
            res,
            400,
            {
              error:
                "Missing url",
            }
          );
        }

        let targetUrl;

        try {
          targetUrl =
            new URL(target);
        } catch {
          return jsonResponse(
            res,
            400,
            {
              error:
                "Invalid URL",
            }
          );
        }

        if (
          targetUrl.protocol !==
          "https:"
        ) {
          return jsonResponse(
            res,
            400,
            {
              error:
                "Only HTTPS sources are allowed",
            }
          );
        }

        try {
          await proxyRequest(
            targetUrl,
            req,
            res
          );
        } catch (error) {
          console.error(
            "Proxy error:",
            error.message
          );

          if (
            !res.headersSent
          ) {
            res.writeHead(502);
          }

          if (
            !res.writableEnded
          ) {
            res.end(
              "Proxy error"
            );
          }
        }

        return;
      }


      // ===============================================
      // 405
      // ===============================================

      if (
        req.method !==
          "GET" &&
        req.method !==
          "HEAD"
      ) {
        res.writeHead(
          405,
          {
            Allow:
              "GET, POST, HEAD, OPTIONS",
          }
        );

        return res.end(
          "Method Not Allowed"
        );
      }


      // ===============================================
      // 404
      // ===============================================

      res.writeHead(404);

      res.end(
        "Not found"
      );
    }
  );


// =====================================================
// SERVER SETTINGS
// =====================================================

server.keepAliveTimeout =
  65000;

server.headersTimeout =
  66000;

server.requestTimeout =
  30000;


// =====================================================
// START
// =====================================================

server.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "             HLS PROXY"
    );
    console.log(
      "=========================================="
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Master: http://127.0.0.1:${PORT}/index.m3u8`
    );

    console.log(
      `Video:  http://127.0.0.1:${PORT}/video.m3u8`
    );

    console.log(
      `Audio:  http://127.0.0.1:${PORT}/audio.m3u8`
    );

    console.log(
      `Payment: http://127.0.0.1:${PORT}/payment`
    );

    console.log(
      `Transaction: http://127.0.0.1:${PORT}/transaction`
    );

    console.log(
      "=========================================="
    );
    console.log("");
  }
);


// =====================================================
// SHUTDOWN
// =====================================================

function shutdown() {
  console.log(
    "Shutting down..."
  );

  server.close(
    () => {
      httpsAgent.destroy();

      process.exit(0);
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