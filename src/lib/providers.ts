// Fournisseurs OpenAI-compatibles gérés côté client (localStorage).
// Les clés ne transitent QUE dans le corps de la requête /api/chat
// et ne sont jamais persistées côté serveur.

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export const BUILTIN_PROVIDER_ID = "builtin";

const PROVIDERS_KEY = "grok-providers";
const ACTIVE_KEY = "grok-active-provider";

export function loadProviders(): Provider[] {
  try {
    const raw = window.localStorage.getItem(PROVIDERS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (p): p is Provider =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as Provider).id === "string" &&
          typeof (p as Provider).name === "string",
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl ?? "",
        apiKey: p.apiKey ?? "",
        model: p.model ?? "",
      }));
  } catch {
    return [];
  }
}

export function saveProviders(providers: Provider[]) {
  window.localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
}

export function loadActiveProviderId(): string {
  return window.localStorage.getItem(ACTIVE_KEY) || BUILTIN_PROVIDER_ID;
}

export function saveActiveProviderId(id: string) {
  window.localStorage.setItem(ACTIVE_KEY, id);
}

export function makeId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
