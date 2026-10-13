const HEX_RADIX = 16;
const HEX_WIDTH = 2;
const encoder = new TextEncoder();

export function byteLength(text: string): number {
	return encoder.encode(text).length;
}

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
	return Array.from(new Uint8Array(digest), (value) =>
		value.toString(HEX_RADIX).padStart(HEX_WIDTH, "0"),
	).join("");
}
