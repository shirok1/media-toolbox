import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import "./App.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
		<div className="min-h-svh bg-background text-foreground dark">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 lg:px-10">
				<header className="flex flex-col gap-4">
					<div className="space-y-2">
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							Audio Extractor
						</h1>
					</div>
				</header>

				<Separator />

				<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
					<Card>
						<CardHeader>
							<CardTitle>Video input</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Label
								htmlFor="video-input"
								onDragOver={(event) => {
									event.preventDefault();
									setIsDragging(true);
								}}
								onDragLeave={() => setIsDragging(false)}
								onDrop={handleDrop}
								className={cn("group block cursor-pointer")}
							>
								<div
									className={cn(
										"flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition",
										isDragging
											? "border-primary/70 bg-primary/10 shadow-[0_16px_50px_-40px_rgba(0,0,0,0.6)]"
											: "border-border/70 bg-muted/30",
									)}
								>
									{selectedFile ? (
										<div className="w-full max-w-md space-y-4 text-left">
											<div>
												<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
													Current file
												</p>
												<p className="mt-2 text-base font-semibold">
													{fileSummary}
												</p>
											</div>
										</div>
									) : (
										<div className="space-y-4">
											<div className="space-y-1 text-sm text-muted-foreground">
												<p className="text-base font-semibold text-foreground">
													{isDragging
														? "Release to load the video"
														: "Drop zone"}
												</p>
												{/*<p>Drag a video here or click to choose a file.</p>*/}
											</div>
											<div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
												<Badge variant="secondary">MP4</Badge>
												<Badge variant="secondary">MOV</Badge>
												<Badge variant="secondary">MKV</Badge>
												<Badge variant="secondary">AVI</Badge>
											</div>
											<Button asChild size="sm">
												<span>Choose file</span>
											</Button>
										</div>
									)}
								</div>
								<Input
									id="video-input"
									type="file"
									accept="video/*"
									className="sr-only"
									onChange={(event) => handleFiles(event.target.files)}
								/>
							</Label>
						</CardContent>
					</Card>

					<div className="flex flex-col gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Logging console</CardTitle>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-[260px] rounded-lg border bg-muted/40">
									<div className="space-y-2 p-4 font-mono text-xs text-primary">
										{logs.map((log, index) => (
											<p key={`${log}-${index}`} className="leading-relaxed">
												{log}
											</p>
										))}
									</div>
								</ScrollArea>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Output</CardTitle>
							</CardHeader>
							<CardContent>
								<Button size="lg" className="w-full sm:w-auto">
									Save result
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
