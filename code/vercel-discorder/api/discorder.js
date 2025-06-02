const axios = require("axios").default;

module.exports = async (req, res) => {
  // Set CORS headers to allow GitHub to make requests
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Log request details for debugging
  console.log("Request received:", {
    method: req.method,
    url: req.url,
    path: req.url,
    headers: req.headers,
  });

  try {
    // Handle GET requests for browser testing
    if (req.method === "GET") {
      console.log("Processing GET request");
      return res.status(200).json({
        message: "Discord webhook endpoint is ready!",
        usage:
          "Send a POST request with GitHub webhook payload to trigger a Discord message.",
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasWebhookUrl: !!process.env.DISCORD_WEBHOOK_URL,
        },
      });
    }

    // Handle POST requests (GitHub webhook)
    if (req.method === "POST") {
      console.log("Processing POST request");
      const body = req.body || {};
      console.log("Request body type:", typeof body);

      // Parse body if it's a string (some webhook configurations might send this way)
      let parsedBody = body;
      if (typeof body === "string") {
        try {
          parsedBody = JSON.parse(body);
          console.log("Parsed string body successfully");
        } catch (parseErr) {
          console.error("Failed to parse request body:", parseErr.message);
          return res.status(400).json({
            error: "Invalid JSON in request body",
            details: parseErr.message,
          });
        }
      }

      console.log(
        "Request body (first 500 chars):",
        JSON.stringify(parsedBody).substring(0, 500)
      );

      // Check if proper payload is provided
      if (!parsedBody.sender || !parsedBody.repository) {
        console.log("Invalid payload - missing sender or repository");
        return res.status(400).json({
          error: "Invalid webhook payload. Missing sender or repository data.",
          receivedBodyKeys: Object.keys(parsedBody),
        });
      }

      const username = parsedBody.sender.login;
      const avatarUrl = parsedBody.sender.avatar_url;
      const repoName = parsedBody.repository.name;
      const fullRepoName = parsedBody.repository.full_name;
      const eventType = req.headers["x-github-event"] || "unknown";

      console.log("Event data:", {
        event: eventType,
        username,
        repo: fullRepoName,
      });

      // Check if webhook URL is set
      if (!process.env.DISCORD_WEBHOOK_URL) {
        console.error("DISCORD_WEBHOOK_URL not found in environment variables");
        return res.status(500).json({
          error: "Server configuration error: Discord webhook URL not set",
        });
      }

      // Create appropriate message based on event type
      let content = `:star: ${username} starred ${fullRepoName}! :rocket:`;
      if (eventType === "push") {
        content = `:arrow_up: ${username} pushed to ${fullRepoName}! :code:`;
      } else if (eventType === "issues") {
        content = `:bookmark: ${username} opened an issue on ${fullRepoName}! :pencil:`;
      }

      // Send to Discord
      try {
        console.log("Sending to Discord webhook...");
        const discordResponse = await axios.post(
          process.env.DISCORD_WEBHOOK_URL,
          {
            content: `:taco: ${content} :taco:`,
            embeds: [
              {
                image: {
                  url: avatarUrl,
                },
              },
            ],
          }
        );

        console.log("Discord API Response:", {
          status: discordResponse.status,
          statusText: discordResponse.statusText,
        });

        console.log("Message successfully sent to Discord!");
        return res.status(204).send();
      } catch (discordErr) {
        console.error(
          "Discord API Error:",
          discordErr.response
            ? {
                status: discordErr.response.status,
                data: discordErr.response.data,
              }
            : discordErr.message
        );

        return res.status(500).json({
          error: "Failed to send message to Discord",
          details: discordErr.message,
        });
      }
    }

    // Handle unsupported methods
    return res.status(405).json({
      error: `Method ${req.method} not allowed`,
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({
      error: "Server error",
      message: err.message || err.toString(),
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};
