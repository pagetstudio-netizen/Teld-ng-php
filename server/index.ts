import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seed } from "./seed";
import { storage } from "./storage";
import { sendDailyTelegramSummary, startTelegramBot } from "./telegram";

const app = express();
const httpServer = createServer(app);
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https: wss:",
    );
  }
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "8mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "15mb" }));

const INTERNAL_ERROR_PATTERNS = [
  /failed query:/i,
  /^\s*(select|insert|update|delete|alter|create|drop)\b/i,
  /\bparams?:/i,
  /\b(relation|column|constraint) .* does not exist\b/i,
  /\bduplicate key value\b/i,
  /\bviolates .* constraint\b/i,
  /\binvalid input syntax\b/i,
  /\bsyntax error at or near\b/i,
  /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/i,
  /\bat .*\/(server|node_modules)\//i,
];

app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string" &&
      (
        res.statusCode >= 500 ||
        INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(String(body.message)))
      )
    ) {
      return originalJson({
        message: res.statusCode === 502 ? "Service temporarily unavailable" : "Request failed",
      });
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => {
      if (/password|secret|token|screenshot|accountNumber|adminPin/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redactLogValue(child)];
    }),
  );
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Security: block the well-known /admin path at the server level.
  // Any request to /admin or /admin/* returns a plain 404, indistinguishable
  // from a non-existent route. The real admin UI is served only under the
  // The path is only an obscurity layer; admin API authorization remains mandatory.
  app.use((req, res, next) => {
    const p = req.path;
    if (p === "/admin" || p.startsWith("/admin/")) {
      return res.status(404).send("Not found");
    }
    next();
  });

  // Seed database with initial data
  await seed().catch(console.error);
  
  await registerRoutes(httpServer, app);
  startTelegramBot();
  const scheduleTelegramSummary = () => {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(now.getHours() < 12 ? 12 : 24);
    const delay = Math.max(1000, next.getTime() - now.getTime());
    setTimeout(() => {
      void sendDailyTelegramSummary().catch((error) => console.error("[telegram] summary failed:", error.message));
      scheduleTelegramSummary();
    }, delay);
  };
  scheduleTelegramSummary();

  // Process daily earnings and staking releases
  const processEarningsInterval = async () => {
    try {
      await storage.processEarnings();
      log("Daily earnings processed successfully", "earnings");
    } catch (error) {
      console.error("Error processing daily earnings:", error);
    }
    try {
      await storage.releaseMaturedStakings();
    } catch (error) {
      console.error("Error releasing stakings:", error);
    }
  };
  
  // Run immediately on startup
  setTimeout(processEarningsInterval, 5000);
  
  // Then run every 5 minutes to ensure timely earnings processing
  setInterval(processEarningsInterval, 5 * 60 * 1000);

  // Clean up deposit screenshots: approved/rejected deposits lose their image after 24h
  const cleanupScreenshots = async () => {
    try {
      await storage.cleanupDepositScreenshots();
      log("Deposit screenshots cleanup done", "cleanup");
    } catch (error) {
      console.error("Error cleaning up deposit screenshots:", error);
    }
  };
  setTimeout(cleanupScreenshots, 10000);
  setInterval(cleanupScreenshots, 60 * 60 * 1000); // every hour

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : (err.message || "Request failed");

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message, requestId: req.headers["x-request-id"] || undefined });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
