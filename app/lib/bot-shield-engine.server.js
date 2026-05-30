const DEFAULT_ENGINE =
  "https://fc5959b3-318c-4556-8c3a-da7f7c4e737a-00-3mar8mcnq27ya.spock.replit.dev";

export function getEngineBaseUrl() {
  return (
    process.env.BOT_SHIELD_ENGINE_URL?.replace(/\/$/, "") || DEFAULT_ENGINE
  );
}

export async function scanWithEngine(body) {
  return fetch(`${getEngineBaseUrl()}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
