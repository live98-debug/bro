// server.js

const gymt = `0cAFcWeA4O1dFtZFWkq0PHmcI15xhjNvuZeSdo2LqzO6JFBETqPBan52rXYwjMZkVRIdiRtei06JwNZNEfpNTkMivbu6H3tN9P3Do7MXioWES4b7m7iB2JhbKhMKakCM3Ou8PB_ZeNPfdYMYQjadvDOeG4sWWa5-41Cf1rE2McolOrIaxVc5qqv9BeZJsVcEd3h6KM1HPBwwTKuHVxwUMXTs_u_rRD13yYycqpifU-c0eq0_u1XBn22ZEBrLeAftASI5kpC4LKzZY4_jl61vMcSTGIdvIDhQQ_KP6XYKcRF9pfmhUs-7ZpqK-fcKGZp-AvGZ_7Ae2Gp26-C6u122RKz0xjyhcqkNCGhAwsv6DAUDc5K70PEQGBtjfATtXpAu3OnXBzyZT_lhUANgtWLlgTHn3EmXz8JlJStnyXc7auoSlLRD-8WleyZY2OvSqsE4mOkgUDUoept8vkuGzCL92z7XXN8qo2NjV6hbSqg-eWGeCZzSvkMuKzF0ukvK-Ks8RxhtgrpjJT4hnztl5sf0JpiSpdVTdT6KEuI4tGb293v0qHI8IB4xBbVry0heaBt6qDyHrkBOew2mIcrFn5SR0XTXMHNhez-AQV-KqQEYncUmqcoPjAUMBAYDbCrKipo0vONb80xpoub2UMlu2yDWlN696UqgBeLTknlEfmN1giC4YudBz6I6JABtkX2kXmugb04QQW3FTwhdweBhehN1f6ZtPpKSC_UX7IJ5YmJWnkte0oiKCzmONuBynlUeK2JwEmc4osmmM9BFFkB7ULagJSA_NFQJRDy9z_xgg8hHe7Rb9Zyo_afUjlWZrVuwfbMG4_9B3nkFJD9vRHel3FMZf7jWiukFeMqkx6V59_IXu5DAbKRIrmfObTBeuRh_a9GbZPW9Yn2KDi4Os-5aMV5O1QilQD9lJeASEXoCbBueB6AqSWNxLMbhSk2er56vZnu0LX5BFKu88BsWqG0ZbJgnkulwDRDdPakP5MbfN62hiC76nytDHsp64Mz0RCd8GeNBdh_0I7ROcOMbSk-LRMWFr14t43rL4xJYuqZ9IXu4MwazTQSCwDbQrt_T4uwnXL4Y8GWiFPjQikd7LN7XOlGXw6SXVY3ttorC_CM9_mJe1rmLQtxWPQDDG7iU0Sc-s2aCLSEm6wS8iLIBg15HK5XUp_3fPs7zhLQuFvf9dLJ8-oKw-qz866CvI-1EvV6_NcVZeB7p9_FV0iLzenF5pmqof9_AXS6rdlsT5HGJH-7oiHHDbZS_SAzuY0P7LsxNyQmQNa_5SYfeOiiA4ivyWxv5iSVFygFgmf5X-7W730YKGXm1Gfbt_DWO3WUxMhS3I-y9tFNz3ETe5lx-YQ_TSEEtM7OxBFNcjOuXk3fLcMi1tqgZaRFPLzdOodruxY-zQRjpf__VtwTW3ppQf4TkSGZbvckK0_2W91Gx7-rL6GWXCJHp-NLRO98XabEmRqhX4gmG5SIXc8WK--euFqNgIuSoo28IiGnboco2aXS7afVipMEioEmWJtLWMOYSfIj4ykngcqHALzzGeBRTwCTMchY2ERiHd64oQdFPJvxBkfp9Pl78K2G1HwLKODzYHaopF_IWZSLdtJE-j7pEQGf2it19X4A9E2TaJra0he-1f6_h4rjtLfkZi9zZhKC3fPHIMDtck53Vqheds81uwdUiV-BS4hdO2-TTenbrO6p-Edt9vIxP7ywU1PJwolKxaBgKertOJMIhtv0yZemfvVcHdmkd5UMT8Dnt7YUs0Wg5x1m1RSXon9TN6nwOnZWHmDSZ7uFfxY2LSfkiElLugyiifxQduNgICj9Nvc92vbjyqoN14bXNLIopX_yzJq__UBnPqfxFwGMHmQ4LH5ZEYhpPBrrWaQu1wNfyXMJZG4Ui7D6f2JQSlqnS9tevlxNAzAaeb9NHvBdoOE7i9NshhSO8SZQ6yzG1LK8tfsYz6Hbt6DnnBaW2TkyLubHhtnYYGxyiCzlDWD3TcbJIH75Io_eH16rmq_HezYd5-gMCQV9ONZ8ceGVqbxEovDxuSw1BSslsCwbtVjct8QfwFOmmhg2XyRnPRRLvYrH9H3utinzZojmfwDwzACd-lRNMhhHjjMGMTp-uxpnkR-U--d3EXKTVJS_Zll53OWywBsIiAQWTuCPaIbSZunWgbAmHHGSND_oh1nOYyW8f7YVgeDPyOGhsEagEV-eYRMt_ZOgvSpHISr06lF-RPJXRB7paG1DR90AnvXxaOq9r1gzHq7GbPkLUxPvHPTnIUjWXDmN4jjv-kA8EvGG5HYDT8-mkTV7z-JZS0_3S-A3r1NUeJe_YTSjunim_uPQMMEJ0KlO5ItH7D0p3K9cMCtxewoeM-j2xZYB52SyvGXbt8v3Zu67lMRXhCNKkYs7uTbvf_eCJEQC9M9Eg70Dr_i2NRDSPeaT_8`;

const rawRequest = `POST /api/v3/media/47b201e2-a92d-4c08-b4e3-b739b94de504/stream_url HTTP/1.1
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36
Cookie: auth._refresh_token_expiration.local=1788361218000; Path=/; auth._refresh_token.local=eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJBVURfU1VCX01ZIiwiZXhwIjoxNzg4MzYxMjE4LCJpYXQiOjE3ODc3NTY0MTgsImlzcyI6IiIsImp0aSI6IjkzYjlmMTE3LTJjMDQtNDk2Yy05MmUxLWU0NGRjMjA3YWQ5ZCIsIm5iZiI6MTc4Nzc1NjQxNywic3ViIjoiMjcwOTg4IiwidHlwIjoicmVmcmVzaF90b2tlbiJ9.Acd2Rp02HjGGElP_1fEKbeXJ29EAK10z4DdQc8v9Sz7XdRAfZQyB17f6p9tlCSonGFe3m0NZYXboWgIlePPHhaPkAEphRW1xBWoi9L-5uIyGwgE8IEbP2hYzUHw23cqjwDefmo7-LiVQErZfAloduTwRH3_yQn64L61gmRQ49K1OhbEN; Path=/; auth._token_expiration.local=1792770818000; Path=/; auth._token.local=Bearer%20eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJBVURfU1VCX01ZIiwiZXhwIjoxNzg3NzcwODE4LCJpYXQiOjE3ODc3NTY0MTgsImlzcyI6IiIsImp0aSI6IjBlNWY1MTgxLTljMGUtNGQ2YS1iM2E1LTIxNTAzY2E0ODZlYiIsIm5iZiI6MTc4Nzc1NjQxNywicm9sZXMiOltdLCJzdWIiOiIyNzA5ODgiLCJ0eXAiOiJhY2Nlc3NfdG9rZW4ifQ.AMjfyPLcYFG_yw0CjjoU2sRnOE9DMvC9Gf3rOmYOa1ZeTg7Thsjx75t0iLU6hc19WhhiO4rWnpkSoGlGK97z1zZrAXM3E7KyG0GoSFdhwU5IUO3DWGhRSuKcy9nsH9KsrE6AJm6xZSKHyWd3MM0em8No4-bpq5DJH8yzs7R3b3H37OGP; Path=/; auth.strategy=local; Path=/; i18n_redirected=am; Path=/; Expires=Thu, 26 Aug 2027 15:00:18 GMT; SameSite=Lax; Path=/; HttpOnly; Secure
Authorization: Bearer eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJBVURfU1VCX01ZIiwiZXhwIjoxNzg3NzcwODE4LCJpYXQiOjE3ODc3NTY0MTgsImlzcyI6IiIsImp0aSI6IjBlNWY1MTgxLTljMGUtNGQ2YS1iM2E1LTIxNTAzY2E0ODZlYiIsIm5iZiI6MTc4Nzc1NjQxNywicm9sZXMiOltdLCJzdWIiOiIyNzA5ODgiLCJ0eXAiOiJhY2Nlc3NfdG9rZW4ifQ.AMjfyPLcYFG_yw0CjjoU2sRnOE9DMvC9Gf3rOmYOa1ZeTg7Thsjx75t0iLU6hc19WhhiO4rWnpkSoGlGK97z1zZrAXM3E7KyG0GoSFdhwU5IUO3DWGhRSuKcy9nsH9KsrE6AJm6xZSKHyWd3MM0em8No4-bpq5DJH8yzs7R3b3H37OGP
Referer: https://mayya.et/live/47b201e2-a92d-4c08-b4e3-b739b94de504
Origin: https://mayya.et
X-Mayya-Dev-Id: 1973268948
Content-Type: application/json
Host: mayya.et
Connection: keep-alive
Accept-Encoding: gzip, deflate, br
Content-Length: 3069

{"token":{"platform":"mayya_web"},"sig":"AMgeTQa4W4aYcSTeKyHb-tB54IemhCA15ja4Ure3r9Q","client_id":"NsyUvm4o3hZygBnHXRbdG3F7SnWwRpuO",
"gyma":"play_video","device":{"device_id":"76a87196a951083d78a4f152f2ccc018","client_type":"browser","client_engine":"Chrome","client_engine_version":"125.0.0.0","device_type":"other","device_name":"Chrome() 125.0.0.0","os_name":"Android","os_version":"","ua":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36","model":"Macintosh","brand":"Apple","totalMemory":8192,"systemFeatures":"webgl,webrtc,touch,camera","extra":{"cores":8}}}`;


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