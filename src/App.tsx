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
					<Badge variant="outline">Media Toolbox</Badge>
					<div className="space-y-2">
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							Audio Extractor
						</h1>
						<p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
							Drop a video, extract the audio, save the result.
						</p>
					</div>
				</header>

				<Separator />

				<Card>
					<CardHeader>
						<CardTitle>Video input</CardTitle>
						<CardDescription>
							Drag a file in, or choose from your device.
						</CardDescription>
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
							className={cn(
								"group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-6 text-center transition",
								isDragging
									? "border-primary/60 bg-primary/10 text-primary-foreground"
									: "border-border/70 bg-muted/20 hover:border-muted-foreground/60",
							)}
						>
							<p className="text-base font-medium">
								{isDragging ? "Release to add video" : "Drag your video here"}
							</p>
							<div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
								<Badge variant="secondary">MP4</Badge>
								<Badge variant="secondary">MOV</Badge>
								<Badge variant="secondary">MKV</Badge>
							</div>
							<Button asChild variant="secondary" size="sm">
								<span>Open file picker</span>
							</Button>
							<Input
								id="video-input"
								type="file"
								accept="video/*"
								className="sr-only"
								onChange={(event) => handleFiles(event.target.files)}
							/>
						</Label>

						<div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
									Current file
								</p>
								<p className="mt-1 text-sm font-medium">{fileSummary}</p>
							</div>
							<Badge variant={selectedFile ? "default" : "secondary"}>
								{selectedFile ? "Loaded" : "Empty"}
							</Badge>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Logging console</CardTitle>
						<CardDescription>Latest extraction events.</CardDescription>
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
						<CardDescription>Ready to save extracted audio.</CardDescription>
					</CardHeader>
					<CardFooter className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm text-muted-foreground">
							Export the audio to your default download folder.
						</p>
						<Button size="lg" className="w-full sm:w-auto">
							Save result
						</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}

export default App;
