// server.js

const gymt = ``;

const rawRequest = ``


// Insert gymt into the raw request
const requestWithGymt =
    rawRequest.replace("__GYMT__", gymt);


// Parse the raw HTTP request
function parseRawRequest(raw) {

    const normalized =
        raw.replace(/\r\n/g, "\n");

    const separator =
        normalized.indexOf("\n\n");

    if (separator === -1) {
        throw new Error(
            "Could not find end of HTTP headers"
        );
    }

    const headerPart =
        normalized.slice(0, separator);

    const body =
        normalized.slice(separator + 2).trim();


    const lines =
        headerPart.split("\n");


    // Example:
    // POST /api/... HTTP/1.1

    const requestLine =
        lines.shift().trim();

    const [
        method,
        path,
        httpVersion
    ] = requestLine.split(/\s+/);


    const headers = {};


    for (const line of lines) {

        const index =
            line.indexOf(":");

        if (index === -1) {
            continue;
        }

        const key =
            line.slice(0, index).trim();

        const value =
            line.slice(index + 1).trim();

        headers[key] = value;
    }


    return {
        method,
        path,
        httpVersion,
        headers,
        body
    };
}


// Execute request
async function executeRequest(raw) {

    const request =
        parseRawRequest(raw);


    console.log("\n========== REQUEST ==========");

    console.log(
        `${request.method} ${request.path} ${request.httpVersion}`
    );

    console.log("\nHeaders:");

    console.dir(
        request.headers,
        { depth: null }
    );


    // Parse JSON body

    let jsonBody;

    try {

        jsonBody =
            JSON.parse(request.body);

    } catch (error) {

        console.error(
            "Invalid JSON body:"
        );

        console.error(error);

        return;
    }


    console.log("\nBody:");

    // Don't print the complete gymt
    console.log({
        ...jsonBody,
        gymt: `[${String(jsonBody.gymt).length} characters]`
    });


    const host =
        request.headers.Host ||
        request.headers.host;


    if (!host) {
        throw new Error(
            "Host header is missing"
        );
    }


    const url =
        `https://${host}${request.path}`;


    console.log("\nURL:");
    console.log(url);


    // Headers that should actually be sent.
    // Content-Length, Connection and Accept-Encoding
    // are handled by Node/fetch.

    const headers = {
        "User-Agent":
            request.headers["User-Agent"],

        "Authorization":
            request.headers["Authorization"],

        "Referer":
            request.headers["Referer"],

        "Origin":
            request.headers["Origin"],

        "X-Mayya-Dev-Id":
            request.headers["X-Mayya-Dev-Id"],

        "Content-Type":
            request.headers["Content-Type"],

        "Accept":
            "application/json"
    };


    // Remove undefined headers

    Object.keys(headers).forEach(key => {

        if (headers[key] === undefined) {
            delete headers[key];
        }

    });


    console.log("\nSending request...");


    const response =
        await fetch(url, {

            method:
                request.method,

            headers,

            body:
                request.body

        });


    const responseText =
        await response.text();


    console.log("\n========== RESPONSE ==========");

    console.log(
        "Status:",
        response.status
    );


    console.log("\nResponse headers:");

    console.dir(
        Object.fromEntries(
            response.headers.entries()
        ),
        { depth: null }
    );


    console.log("\nResponse body:");

    console.log(responseText);


    console.log(
        "\n=============================="
    );


    return responseText;
}


// Run
executeRequest(requestWithGymt)
    .catch(error => {

        console.error(
            "\nREQUEST ERROR:"
        );

        console.error(error);

    });