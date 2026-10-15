import type {
	PlanRequest,
	PlanResponse,
	PushRequest,
	PushResponse,
	RemoveRequest,
} from "../../contract/types";
import type { HttpRequest, HttpResponse, Transport } from "../types";

export interface FakeServerState {
	calls: Array<{ route: string; body: unknown }>;
	plan: Partial<PlanResponse>;
	pushHandler?: (body: PushRequest) => HttpResponse;
	removeHandler?: (body: RemoveRequest) => HttpResponse;
	failRoute?: { route: string; response: HttpResponse };
}

export function jsonResponse(body: unknown, status = 200): HttpResponse {
	return { status, text: JSON.stringify(body) };
}

export function errorResponse(
	code: string,
	status: number,
	extra: Record<string, unknown> = {},
): HttpResponse {
	return jsonResponse({ error: { code, ...extra } }, status);
}

export function createFakeServer(plan: Partial<PlanResponse> = {}) {
	const state: FakeServerState = { calls: [], plan };
	const handle = (request: HttpRequest): HttpResponse => {
		const route = request.url.split("/sync/v1/")[1] as string;
		const body = request.body ? JSON.parse(request.body) : undefined;
		state.calls.push({ route, body });
		if (state.failRoute?.route === route) {
			return state.failRoute.response;
		}
		if (route === "plan") {
			const manifest = (body as PlanRequest).manifest;
			return jsonResponse({
				runId: "run_1",
				expiresAt: 0,
				add: manifest.map((entry) => entry.path),
				update: [],
				retry: [],
				remove: [],
				unchangedCount: 0,
				skipped: [],
				massRemove: false,
				quota: {
					plan: "free",
					limitBytes: 1000,
					usedBytes: 0,
					afterBytes: 10,
					limitNotes: 500,
					usedNotes: 0,
					afterNotes: 1,
				},
				campaign: { name: "Strahd" },
				connection: { name: "Vault" },
				...state.plan,
			} satisfies PlanResponse);
		}
		if (route === "push") {
			if (state.pushHandler) {
				return state.pushHandler(body as PushRequest);
			}
			return jsonResponse({
				results: (body as PushRequest).files.map((file) => ({
					path: file.path,
					status: "accepted",
				})),
			} satisfies PushResponse);
		}
		if (route === "remove") {
			if (state.removeHandler) {
				return state.removeHandler(body as RemoveRequest);
			}
			return jsonResponse({
				results: (body as RemoveRequest).paths.map((path) => ({
					path,
					status: "removed",
				})),
			});
		}
		return jsonResponse({ ok: true });
	};
	const transport: Transport = (request) => Promise.resolve(handle(request));
	return { state, transport };
}
