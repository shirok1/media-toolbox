import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const formatBytes = (bytes: number) => {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** index;

	return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatTimestamp = () =>
	new Date().toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

function App() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [logs, setLogs] = useState<string[]>([
		`${formatTimestamp()} Ready to extract audio.`,
		`${formatTimestamp()} Waiting for input...`,
	]);

	const fileSummary = useMemo(() => {
		if (!selectedFile) {
			return "No video loaded yet.";
		}

		return `${selectedFile.name} • ${formatBytes(selectedFile.size)}`;
	}, [selectedFile]);

	const appendLog = (message: string) => {
		setLogs((prev) =>
			[`${formatTimestamp()} ${message}`, ...prev].slice(0, 50),
		);
	};

	const handleFiles = (files: FileList | null) => {
		const file = files?.[0];
		if (!file) {
			return;
		}

		setSelectedFile(file);
		appendLog(`Loaded ${file.name} (${formatBytes(file.size)})`);
		appendLog("Prepared extraction job.");
	};

	const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
		event.preventDefault();
		setIsDragging(false);
		handleFiles(event.dataTransfer.files);
	};

	return (
		<div className="min-h-svh bg-slate-950 text-white">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 lg:px-10">
				<header className="flex flex-col gap-4">
					<h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
						Audio Extractor
					</h1>
					<p className="max-w-2xl text-base text-white/70">
						Drop a video, extract the audio, save the result.
					</p>
				</header>

				<section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
					<div>
						<h2 className="text-lg font-semibold">Video input</h2>
						<p className="text-sm text-white/60">
							Drag a file in, or choose from your device.
						</p>
					</div>

					<label
						htmlFor="video-input"
						onDragOver={(event) => {
							event.preventDefault();
							setIsDragging(true);
						}}
						onDragLeave={() => setIsDragging(false)}
						onDrop={handleDrop}
						className={`group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition ${
							isDragging
								? "border-emerald-300/80 bg-emerald-400/10"
								: "border-white/20 bg-white/5 hover:border-white/40"
						}`}
					>
						<p className="text-base font-medium">
							{isDragging ? "Release to add video" : "Drag your video here"}
						</p>
						<p className="text-sm text-white/60">MP4, MOV, or MKV.</p>
						<Button asChild variant="secondary" size="sm">
							<span>Open file picker</span>
						</Button>
						<input
							id="video-input"
							type="file"
							accept="video/*"
							className="sr-only"
							onChange={(event) => handleFiles(event.target.files)}
						/>
					</label>

					<div className="rounded-xl border border-white/10 bg-black/40 p-4">
						<p className="text-xs uppercase tracking-[0.3em] text-white/50">
							Current file
						</p>
						<p className="mt-2 text-base font-medium">{fileSummary}</p>
					</div>
				</section>

				<section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-6">
					<h2 className="text-lg font-semibold">Logging console</h2>
					<div className="h-[260px] overflow-auto rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-xs text-emerald-200">
						{logs.map((log, index) => (
							<p key={`${log}-${index}`} className="leading-relaxed">
								{log}
							</p>
						))}
					</div>
				</section>

				<div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
					<p className="text-sm text-white/60">
						Ready to save extracted audio.
					</p>
					<Button size="lg" className="w-full sm:w-auto">
						Save result
					</Button>
				</div>
			</div>
		</div>
	);
}

export default App;
