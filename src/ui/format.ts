const KILOBYTE = 1024;
const UNITS = ["B", "KB", "MB", "GB"] as const;
const SECOND = 1000;
const MINUTE = 60;
const HOUR = 60;
const DAY = 24;

export function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= KILOBYTE && unit < UNITS.length - 1) {
		value /= KILOBYTE;
		unit += 1;
	}
	const rounded =
		unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
	return `${rounded} ${UNITS[unit]}`;
}

export function formatRelativeTime(at: number, now: number): string {
	const seconds = Math.max(0, Math.round((now - at) / SECOND));
	if (seconds < MINUTE) {
		return "just now";
	}
	const minutes = Math.floor(seconds / MINUTE);
	if (minutes < HOUR) {
		return `${minutes} min ago`;
	}
	const hours = Math.floor(minutes / HOUR);
	if (hours < DAY) {
		return `${hours} h ago`;
	}
	const days = Math.floor(hours / DAY);
	return `${days} d ago`;
}
