const http = require("http");
const https = require("https");

exports.handler = async function (event) {
  const target = event.queryStringParameters && event.queryStringParameters.url;

  if (!target) {
    return json(400, { error: "Missing url" });
  }

  let url;
  try {
    url = new URL(target);
  } catch {
    return json(400, { error: "Invalid url" });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return json(400, { error: "Unsupported url" });
  }

  try {
    let status = await requestStatus(url, "HEAD");

    if (status === 405 || status === 403 || status === 404) {
      status = await requestStatus(url, "GET");
    }

    return json(200, { status });
  } catch (error) {
    return json(200, { status: 0, error: error.message });
  }
};

function requestStatus(url, method, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method,
        headers: {
          "user-agent": "ZenBerry link checker",
        },
      },
      (response) => {
        const location = response.headers.location;
        const isRedirect = response.statusCode >= 300 && response.statusCode < 400;

        if (isRedirect && location && redirects < 5) {
          response.resume();
          resolve(requestStatus(new URL(location, url), method, redirects + 1));
          return;
        }

        response.resume();
        resolve(response.statusCode || 0);
      }
    );

    request.setTimeout(10000, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
