export function fire(task: Promise<unknown>): void {
	task.catch((error: unknown) => {
		console.error("DM Kit Sync", error);
	});
}
