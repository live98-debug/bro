import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";


// ==================================================
// CONFIG
// ==================================================

const PORT = 4060;

const SOURCE = "https://img.refooty.com/m3u8/Real_Madrid_v_Real_Sociedad_2026_08_26.m3u8";

const STREAM_LINK = "https://stream.dashsh.bet/index.m3u8";


// ==================================================
// PHONE / AMOUNT
// ==================================================

const PHONE = [
  "0910101010",
  "0920202020",
  "0941286565",
];

const AMOUNT = 100;


// ==================================================
// PATHS
// ==================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSACTION_FILE = path.join(
  __dirname,
  "transaction.json"
);


// ==================================================
// TRANSACTION FILE
// ==================================================

function ensureTransactionFile() {
  if (!fs.existsSync(TRANSACTION_FILE)) {
    fs.writeFileSync(
      TRANSACTION_FILE,
      "[]",
      "utf8"
    );
  }
}

ensureTransactionFile();


function readTransactions() {
  try {
    const data = fs.readFileSync(
      TRANSACTION_FILE,
      "utf8"
    );

    if (!data.trim()) {
      return [];
    }

    const transactions = JSON.parse(data);

    if (!Array.isArray(transactions)) {
      throw new Error(
        "transaction.json must contain an array"
      );
    }

    return transactions;

  } catch (error) {

    console.error(
      "Failed to read transaction.json:",
      error.message
    );

    return [];
  }
}


function writeTransactions(transactions) {
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

  // Atomic replacement
  fs.renameSync(
    tempFile,
    TRANSACTION_FILE
  );
}


// ==================================================
// TRANSACTION LOCK
// ==================================================
//
// Prevents two POST requests arriving at exactly
// the same time from both inserting the same trx.
//

let transactionLock =
  Promise.resolve();


function withTransactionLock(fn) {

  const next =
    transactionLock.then(fn);

  transactionLock =
    next.catch(() => {});

  return next;
}


// ==================================================
// JSON RESPONSE
// ==================================================

function sendJson(
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


// ==================================================
// READ REQUEST BODY
// ==================================================

function readBody(req) {

  return new Promise(
    (resolve, reject) => {

      let body = "";

      let size = 0;

      const MAX_BODY_SIZE =
        1024 * 1024;


      req.on(
        "data",
        (chunk) => {

          size += chunk.length;

          if (
            size >
            MAX_BODY_SIZE
          ) {

            reject(
              new Error(
                "Request body too large"
              )
            );

            req.destroy();

            return;
          }

          body += chunk.toString();
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


// ==================================================
// GET TRANSACTION INFO
// ==================================================

function handleGetTransaction(
  req,
  res
) {

  if (
    PHONE.length === 0
  ) {

    return sendJson(
      res,
      500,
      {
        error:
          "PHONE array is empty"
      }
    );
  }


  // Random phone from PHONE array
  const phone =
    PHONE[
      Math.floor(
        Math.random() *
        PHONE.length
      )
    ];


  return sendJson(
    res,
    200,
    {
      phone,
      amount: AMOUNT
    }
  );
}


// ==================================================
// POST TRANSACTION
// ==================================================

async function handlePostTransaction(
  req,
  res
) {

  let body;

  try {

    body =
      await readBody(req);

  } catch (error) {

    return sendJson(
      res,
      400,
      {
        error:
          error.message
      }
    );
  }


  let data;

  try {

    data =
      JSON.parse(body);

  } catch {

    return sendJson(
      res,
      400,
      {
        error:
          "Invalid JSON"
      }
    );
  }


  const trx =
    typeof data.trx === "string"
      ? data.trx.trim()
      : "";


  const phone =
    typeof data.phone === "string"
      ? data.phone.trim()
      : "";


  if (!trx) {

    return sendJson(
      res,
      400,
      {
        error:
          "trx is required"
      }
    );
  }


  if (!phone) {

    return sendJson(
      res,
      400,
      {
        error:
          "phone is required"
      }
    );
  }


  // ==================================================
  // SAVE TRANSACTION
  // ==================================================

  try {

    const result =
      await withTransactionLock(
        async () => {

          const transactions =
            readTransactions();


          // ------------------------------------------
          // DUPLICATE CHECK
          // ------------------------------------------

          const existing =
            transactions.find(
              (transaction) =>
                transaction.trx === trx
            );


          if (existing) {

            return {
              duplicate: true
            };
          }


          // ------------------------------------------
          // NEW TRANSACTION
          // ------------------------------------------

          const transaction = {
            trx,
            phone,
            amount: AMOUNT,
            createdAt:
              new Date().toISOString()
          };


          transactions.push(
            transaction
          );


          writeTransactions(
            transactions
          );


          console.log(
            "Transaction saved:",
            transaction
          );


          return {
            duplicate: false,
            transaction
          };
        }
      );


    // ==================================================
    // DUPLICATE
    // ==================================================

    if (
      result.duplicate
    ) {

      return sendJson(
        res,
        409,
        {
          error:
            "Transaction already exists",
          trx
        }
      );
    }


    // ==================================================
    // SUCCESS
    // ==================================================

    return sendJson(
      res,
      200,
      {
        success: true,

        trx,

        phone,

        stream:
          STREAM_LINK
      }
    );


  } catch (error) {

    console.error(
      "Transaction save error:",
      error
    );

    return sendJson(
      res,
      500,
      {
        error:
          "Failed to save transaction"
      }
    );
  }
}


// ==================================================
// HLS HTTP SERVER
// ==================================================

const server =
  http.createServer(
    async (req, res) => {

      // ==================================================
      // CORS
      // ==================================================

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


      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(204);

        return res.end();
      }


      // ==================================================
      // URL
      // ==================================================

      let requestUrl;

      try {

        requestUrl =
          new URL(
            req.url,
            `http://${req.headers.host}`
          );

      } catch {

        return sendJson(
          res,
          400,
          {
            error:
              "Invalid URL"
          }
        );
      }


      // ==================================================
      // GET TRANSACTION
      // ==================================================

      if (
        requestUrl.pathname ===
          "/api/transaction" &&
        req.method === "GET"
      ) {

        return handleGetTransaction(
          req,
          res
        );
      }


      // ==================================================
      // POST TRANSACTION
      // ==================================================

      if (
        requestUrl.pathname ===
          "/api/transaction" &&
        req.method === "POST"
      ) {

        return handlePostTransaction(
          req,
          res
        );
      }


      // ==================================================
      // HLS MASTER PLAYLIST
      // ==================================================

      if (
        requestUrl.pathname ===
          "/index.m3u8"
      ) {

        if (
          req.method !== "GET" &&
          req.method !== "HEAD"
        ) {

          res.writeHead(405);

          return res.end(
            "Method Not Allowed"
          );
        }


        try {

          const playlist =
            await fetchText(
              SOURCE
            );


          const sourceUrl =
            new URL(SOURCE);


          const rewritten =
            playlist
              .split("\n")
              .map((line) => {

                const trimmed =
                  line.trim();


                if (
                  !trimmed ||
                  trimmed.startsWith("#")
                ) {

                  return line;
                }


                const absolute =
                  new URL(
                    trimmed,
                    sourceUrl
                  );


                return `/proxy?url=${encodeURIComponent(
                  absolute.href
                )}`;
              })
              .join("\n");


          res.writeHead(
            200,
            {
              "Content-Type":
                "application/vnd.apple.mpegurl",

              "Cache-Control":
                "no-cache, no-store, must-revalidate",
            }
          );


          if (
            req.method === "HEAD"
          ) {

            return res.end();
          }


          return res.end(
            rewritten
          );


        } catch (error) {

          console.error(
            "Playlist error:",
            error
          );


          res.writeHead(502);

          return res.end(
            "Unable to fetch source playlist"
          );
        }
      }


      // ==================================================
      // HLS PROXY
      // ==================================================

      if (
        requestUrl.pathname ===
          "/proxy"
      ) {

        const target =
          requestUrl.searchParams.get(
            "url"
          );


        if (!target) {

          res.writeHead(400);

          return res.end(
            "Missing url"
          );
        }


        let targetUrl;

        try {

          targetUrl =
            new URL(target);

        } catch {

          res.writeHead(400);

          return res.end(
            "Invalid URL"
          );
        }


        if (
          targetUrl.protocol !==
          "https:"
        ) {

          res.writeHead(400);

          return res.end(
            "Only HTTPS sources are allowed"
          );
        }


        try {

          return proxyRequest(
            targetUrl,
            req,
            res
          );

        } catch (error) {

          console.error(
            "Proxy error:",
            error
          );


          if (
            !res.headersSent
          ) {

            res.writeHead(502);
          }


          res.end(
            "Proxy error"
          );
        }
      }


      // ==================================================
      // 404
      // ==================================================

      res.writeHead(404);

      res.end(
        "Not found"
      );
    }
  );


// ==================================================
// FETCH TEXT
// ==================================================

function fetchText(url) {

  return new Promise(
    (resolve, reject) => {

      const client =
        url.startsWith("https:")
          ? https
          : http;


      const request =
        client.get(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0",

              "Accept":
                "*/*",
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
        10000,
        () => {

          request.destroy(
            new Error(
              "Source request timeout"
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


// ==================================================
// STREAM PROXY
// ==================================================

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


      const proxy =
        client.get(
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


              if (
                !res.headersSent
              ) {

                res.writeHead(
                  response.statusCode ||
                    502
                );
              }


              res.end();

              return resolve();
            }


            const contentType =
              response.headers[
                "content-type"
              ] || "";


            const isPlaylist =
              targetUrl.pathname.endsWith(
                ".m3u8"
              ) ||
              contentType.includes(
                "application/vnd.apple.mpegurl"
              ) ||
              contentType.includes(
                "application/x-mpegURL"
              );


            // ==========================================
            // NESTED PLAYLIST
            // ==========================================

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
                    body
                      .split("\n")
                      .map((line) => {

                        const trimmed =
                          line.trim();


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


                  res.writeHead(
                    200,
                    {
                      "Content-Type":
                        "application/vnd.apple.mpegurl",

                      "Cache-Control":
                        "no-cache, no-store, must-revalidate",
                    }
                  );


                  if (
                    req.method === "HEAD"
                  ) {

                    return res.end();
                  }


                  res.end(
                    rewritten
                  );


                  resolve();
                }
              );


              return;
            }


            // ==========================================
            // VIDEO / AUDIO SEGMENT
            // ==========================================

            const headers = {

              "Content-Type":
                contentType ||
                "application/octet-stream",

              "Cache-Control":
                "public, max-age=3600, immutable",
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


            res.writeHead(
              response.statusCode,
              headers
            );


            if (
              req.method === "HEAD"
            ) {

              response.resume();

              res.end();

              return resolve();
            }


            response.pipe(res);


            response.on(
              "end",
              resolve
            );
          }
        );


      proxy.setTimeout(
        15000,
        () => {

          proxy.destroy(
            new Error(
              "Upstream timeout"
            )
          );
        }
      );


      proxy.on(
        "error",
        reject
      );


      req.on(
        "close",
        () => {

          if (
            !res.writableEnded
          ) {

            proxy.destroy();
          }
        }
      );
    }
  );
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

    console.log(
      `GET: http://127.0.0.1:${PORT}/api/transaction`
    );

    console.log(
      `POST: http://127.0.0.1:${PORT}/api/transaction`
    );
  }
);


// ==================================================
// SHUTDOWN
// ==================================================

function shutdown() {

  server.close(
    () => {
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