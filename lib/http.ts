import { getDefaultTransport, type TodoistApi } from "@doist/todoist-sdk";

/**
 * Every outbound HTTP request gives up after this long.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

type CustomFetch = NonNullable<
  ConstructorParameters<typeof TodoistApi>[1]
>["customFetch"];

/**
 * `fetch` with the per-request timeout, combined with any other signals (e.g.
 * the run's). Uses the Todoist SDK's transport, so proxy environment variables
 * are honoured the same way for every outbound call.
 */
export async function timedFetch(
  url: string,
  init: RequestInit = {},
  ...signals: Array<AbortSignal | null | undefined>
): Promise<Response> {
  const transport = await getDefaultTransport();
  const fetchImpl = (transport?.fetch ?? fetch) as typeof fetch;
  const signal = AbortSignal.any([
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...[init.signal, ...signals].filter((s): s is AbortSignal => Boolean(s)),
  ]);
  return fetchImpl(url, {
    ...init,
    signal,
    // @ts-expect-error - dispatcher is a valid option for Node.js fetch
    dispatcher: transport?.dispatcher,
  });
}

/**
 * A `customFetch` for the Todoist SDK, which has no timeout of its own.
 */
export function todoistFetch(runSignal?: AbortSignal): CustomFetch {
  return async (url, options = {}) => {
    const { timeout: _timeout, ...init } = options;
    const res = await timedFetch(url, init, runSignal);
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      text: () => res.text(),
      json: () => res.json(),
      arrayBuffer: () => res.arrayBuffer(),
    };
  };
}
