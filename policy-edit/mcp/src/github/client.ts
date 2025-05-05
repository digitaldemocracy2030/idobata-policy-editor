import fs from "node:fs";
import path from "node:path";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import config from "../config.js";
import logger from "../logger.js";

let app: App | null = null;
// Define a more specific type for the cached Octokit instance
// Define the custom Octokit class with the REST methods plugin
const OctokitWithRest = Octokit;
// Define a type for the Octokit instance returned by the App
type InstallationOctokit = InstanceType<typeof OctokitWithRest>;
let installationOctokit: InstallationOctokit | null = null;
// tokenExpiration is removed as getInstallationOctokit likely handles token refresh.

function getPrivateKey(): string {
  const keyPath = "/app/secrets/github-key.pem"; // Fixed path inside the container
  try {
    logger.info(`Reading private key from file: ${keyPath}`);
    return fs.readFileSync(keyPath, "utf8");
  } catch (error) {
    logger.error(
      { error, path: keyPath },
      "Failed to read private key from file"
    );
    throw new Error(
      `Could not read GitHub App private key file from ${keyPath}. Ensure the file exists and has correct permissions.`
    );
  }
}

function getApp(): App {
  if (!app) {
    const privateKey = getPrivateKey();
    app = new App({
      appId: config.GITHUB_APP_ID,
      privateKey: privateKey,
      webhooks: { secret: "dummy-secret" }, // Webhookを使わない場合でも必要
      // Use the custom Octokit class that includes the REST plugin
      Octokit: OctokitWithRest.defaults({
        baseUrl: config.GITHUB_API_BASE_URL, // Apply base URL if provided
      }),
    });
    logger.info("GitHub App initialized.");
  }
  return app;
}

// Adjust return type to match the specific InstallationOctokit type
export async function getAuthenticatedOctokit(): Promise<InstallationOctokit> {
  // Check if we already have a cached Octokit instance.
  // getInstallationOctokit might handle caching/refresh, but this adds a layer.
  if (!installationOctokit) {
    logger.info("Initializing GitHub installation Octokit instance...");
    try {
      const appInstance = getApp();
      const installationId = Number.parseInt(config.GITHUB_INSTALLATION_ID, 10);
      if (Number.isNaN(installationId)) {
        throw new Error("Invalid GITHUB_INSTALLATION_ID. Must be a number.");
      }

      // Directly get the authenticated Octokit instance for the installation
      // This method handles token generation and potentially caching/refresh internally.
      // Cast the result to the specific type we need
      installationOctokit = (await appInstance.getInstallationOctokit(
        installationId
      )) as InstallationOctokit;

      logger.info(
        `Initialized Octokit instance for installation ID: ${installationId}`
      );
    } catch (error) {
      logger.error({ error }, "Failed to get GitHub installation token");
      throw new Error("Could not authenticate with GitHub App.");
    }
  } else {
    logger.debug("Using cached GitHub installation token.");
  }
  return installationOctokit;
}
