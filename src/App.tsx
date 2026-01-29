import type { DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import "./App.css";
import { VideoAdd } from "@carbon/icons-react";
import {
	AdtsOutputFormat,
	ALL_FORMATS,
	type AudioCodec,
	BlobSource,
	BufferTarget,
	Conversion,
	FlacOutputFormat,
	Input as MediaInput,
	MkvOutputFormat,
	MovOutputFormat,
	Mp3OutputFormat,
	Mp4OutputFormat,
	OggOutputFormat,
	Output,
	WavOutputFormat,
} from "mediabunny";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
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

const formatDuration = (seconds: number | null) => {
	if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
		return "—";
	}

	const rounded = Math.round(seconds);
	const hours = Math.floor(rounded / 3600);
	const minutes = Math.floor((rounded % 3600) / 60);
	const remainingSeconds = rounded % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(
			remainingSeconds,
		).padStart(2, "0")}`;
	}

	return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

type TrackSummary = {
	codec: string | null;
	sampleRate?: number;
	channels?: number;
	averageBitrate?: number;
};

type MediaMetadata = {
	durationSeconds: number | null;
	formatName: string | null;
	mimeType: string | null;
	audio: TrackSummary | null;
	tags: {
		title?: string;
		artist?: string;
		album?: string;
		date?: Date;
	};
};

function App() {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [logs, setLogs] = useState<string[]>([
		`${formatTimestamp()} Ready to extract audio.`,
		`${formatTimestamp()} Waiting for input...`,
	]);
	const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
	const [isReadingMetadata, setIsReadingMetadata] = useState(false);
	const [isExtracting, setIsExtracting] = useState(false);
	const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
	const [outputFileName, setOutputFileName] = useState<string | null>(null);
	const [outputMimeType, setOutputMimeType] = useState<string | null>(null);
	const [outputFormatLabel, setOutputFormatLabel] = useState<string | null>(
		null,
	);
	const [outputExtension, setOutputExtension] = useState<string | null>(null);
	const metadataRequestId = useRef(0);

	const fileSummary = useMemo(() => {
		if (!selectedFile) {
			return "No video loaded yet.";
		}

		return `${selectedFile.name} • ${formatBytes(selectedFile.size)}`;
	}, [selectedFile]);

	const estimatedOutputSize = useMemo(() => {
		if (
			!metadata?.audio?.averageBitrate ||
			metadata?.durationSeconds === null ||
			metadata.durationSeconds <= 0
		) {
			return null;
		}

		const bytes =
			(metadata.audio.averageBitrate * metadata.durationSeconds) / 8;
		return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
	}, [metadata]);

	const appendLog = (message: string) => {
		setLogs((prev) =>
			[`${formatTimestamp()} ${message}`, ...prev].slice(0, 50),
		);
	};

	const readMetadata = async (file: File) => {
		const requestId = metadataRequestId.current + 1;
		metadataRequestId.current = requestId;
		setIsReadingMetadata(true);
		setMetadata(null);
		appendLog("Reading metadata...");

		const input = new MediaInput({
			formats: ALL_FORMATS,
			source: new BlobSource(file),
		});

		try {
			const [format, durationSeconds, mimeType, tags, audioTrack] =
				await Promise.all([
					input.getFormat(),
					input.computeDuration(),
					input.getMimeType(),
					input.getMetadataTags(),
					input.getPrimaryAudioTrack(),
				]);

			const audioStats = audioTrack
				? await audioTrack.computePacketStats(200)
				: null;

			if (metadataRequestId.current !== requestId) {
				return;
			}

			const audioSummary = audioTrack
				? {
						codec: audioTrack.codec ?? "unknown",
						sampleRate: audioTrack.sampleRate,
						channels: audioTrack.numberOfChannels,
						averageBitrate: audioStats?.averageBitrate,
					}
				: null;

			setMetadata({
				durationSeconds,
				formatName: format.name ?? null,
				mimeType,
				audio: audioSummary,
				tags: {
					title: tags.title,
					artist: tags.artist,
					album: tags.album,
					date: tags.date,
				},
			});

			const tagSummary = [
				tags.title ? `title "${tags.title}"` : null,
				tags.artist ? `artist "${tags.artist}"` : null,
				tags.album ? `album "${tags.album}"` : null,
				tags.date ? `date ${tags.date.toISOString().slice(0, 10)}` : null,
			]
				.filter(Boolean)
				.join(", ");

			appendLog(
				tagSummary
					? `Metadata ready (${tagSummary}).`
					: "Metadata ready (no descriptive tags found).",
			);
		} catch (error) {
			if (metadataRequestId.current !== requestId) {
				return;
			}
			setMetadata(null);
			appendLog(
				`Metadata read failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		} finally {
			input.dispose();
			if (metadataRequestId.current === requestId) {
				setIsReadingMetadata(false);
			}
		}
	};

	const handleFiles = (files: FileList | null) => {
		const file = files?.[0];
		if (!file) {
			return;
		}

		setSelectedFile(file);
		setOutputBlob(null);
		setOutputFileName(null);
		setOutputMimeType(null);
		setOutputFormatLabel(null);
		setOutputExtension(null);
		appendLog(`Loaded ${file.name} (${formatBytes(file.size)})`);
		readMetadata(file);
	};

	const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
		event.preventDefault();
		setIsDragging(false);
		handleFiles(event.dataTransfer.files);
	};

	const selectOutputFormat = (codec: AudioCodec | null) => {
		if (codec === "mp3") {
			return new Mp3OutputFormat();
		}

		if (codec === "aac") {
			return new AdtsOutputFormat();
		}

		if (codec === "flac") {
			return new FlacOutputFormat();
		}

		if (codec === "opus" || codec === "vorbis") {
			return new OggOutputFormat();
		}

		const wav = new WavOutputFormat();
		if (codec && wav.getSupportedAudioCodecs().includes(codec)) {
			return wav;
		}

		const mp4 = new Mp4OutputFormat();
		if (codec && mp4.getSupportedAudioCodecs().includes(codec)) {
			return mp4;
		}

		const mkv = new MkvOutputFormat();
		if (codec && mkv.getSupportedAudioCodecs().includes(codec)) {
			return mkv;
		}

		return new MovOutputFormat();
	};

	const startExtraction = async () => {
		if (!selectedFile) {
			return;
		}

		if (!metadata?.audio) {
			appendLog("No audio track detected. Please choose another file.");
			return;
		}

		setIsExtracting(true);
		setOutputBlob(null);
		setOutputFileName(null);
		setOutputMimeType(null);
		setOutputFormatLabel(null);
		setOutputExtension(null);
		appendLog("Starting audio extraction...");

		const input = new MediaInput({
			formats: ALL_FORMATS,
			source: new BlobSource(selectedFile),
		});

		try {
			const primaryAudio = await input.getPrimaryAudioTrack();
			if (!primaryAudio) {
				appendLog("No audio track detected. Please choose another file.");
				return;
			}

			const outputFormat = selectOutputFormat(primaryAudio.codec ?? null);
			const output = new Output({
				format: outputFormat,
				target: new BufferTarget(),
			});

			setOutputFormatLabel(outputFormat._name);
			setOutputExtension(outputFormat.fileExtension);
			appendLog(
				`Using ${outputFormat._name} container (${
					primaryAudio.codec ?? "unknown codec"
				})`,
			);

			const conversion = await Conversion.init({
				input,
				output,
				video: { discard: true },
				audio: (track) =>
					track.number === primaryAudio.number
						? { codec: primaryAudio.codec ?? undefined }
						: { discard: true },
			});
			if (!conversion.isValid) {
				appendLog("Audio extraction failed: unsupported tracks.");
				return;
			}

			await conversion.execute();

			const rawBuffer = output.target.buffer;
			const arrayBuffer =
				rawBuffer instanceof Uint8Array
					? rawBuffer.buffer.slice(
							rawBuffer.byteOffset,
							rawBuffer.byteOffset + rawBuffer.byteLength,
						)
					: rawBuffer;
			const mimeType =
				(await output.getMimeType().catch(() => null)) ??
				output.format.mimeType ??
				"audio/mpeg";
			const blob = new Blob([arrayBuffer], { type: mimeType });
			const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
			const fileName = `${baseName || "audio"}${
				outputFormat.fileExtension || ""
			}`;

			setOutputBlob(blob);
			setOutputFileName(fileName);
			setOutputMimeType(mimeType);
			appendLog(`Extraction complete (${formatBytes(blob.size)}).`);
		} catch (error) {
			appendLog(
				`Extraction failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		} finally {
			input.dispose();
			setIsExtracting(false);
		}
	};

	const handleSaveResult = () => {
		if (!outputBlob || !outputFileName) {
			return;
		}

		const url = URL.createObjectURL(outputBlob);
		const link = document.createElement("a");
		link.href = url;
		link.download = outputFileName;
		link.click();
		URL.revokeObjectURL(url);
	};

	const outputSizeLabel = outputBlob ? formatBytes(outputBlob.size) : "—";
	const outputFormatLabelText =
		outputFormatLabel ?? (outputExtension ? outputExtension.slice(1) : "—");
	const outputStatus = isExtracting
		? "Extracting audio..."
		: outputBlob
			? "Ready to save"
			: "Waiting to start";

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
					<Label
						htmlFor="video-input"
						onDragOver={(event) => {
							event.preventDefault();
							setIsDragging(true);
						}}
						onDragLeave={() => setIsDragging(false)}
						onDrop={handleDrop}
						className={cn("group block cursor-pointer h-fit")}
					>
						{selectedFile ? (
							<div
								className={cn(
									"rounded-2xl border border-dashed px-6 py-8 text-left transition",
									isDragging
										? "border-primary/70 bg-primary/10 shadow-[0_16px_50px_-40px_rgba(0,0,0,0.6)]"
										: "border-border/70 bg-muted/30",
								)}
							>
								<div className="w-full space-y-4 text-left">
									<div>
										<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
											Current file
										</p>
										<p className="mt-2 text-base font-semibold">
											{fileSummary}
										</p>
									</div>
									<div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Duration
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{formatDuration(metadata?.durationSeconds ?? null)}
											</p>
										</div>
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												File size
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{formatBytes(selectedFile.size)}
											</p>
										</div>
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Audio
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{metadata?.audio
													? `${metadata.audio.codec ?? "unknown"} • ${
															metadata.audio.sampleRate
																? `${Math.round(
																		metadata.audio.sampleRate / 1000,
																	)} kHz`
																: "—"
														}`
													: "—"}
											</p>
										</div>
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Est. output
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{estimatedOutputSize
													? formatBytes(estimatedOutputSize)
													: "—"}
											</p>
										</div>
									</div>
									{metadata?.tags &&
									(metadata.tags.title ||
										metadata.tags.artist ||
										metadata.tags.album ||
										metadata.tags.date) ? (
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Tags
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{[
													metadata.tags.title,
													metadata.tags.artist,
													metadata.tags.album,
													metadata.tags.date
														? metadata.tags.date.toISOString().slice(0, 10)
														: null,
												]
													.filter(Boolean)
													.join(" • ")}
											</p>
										</div>
									) : null}
									{isReadingMetadata ? (
										<p className="text-xs text-muted-foreground">
											Reading metadata...
										</p>
									) : null}
								</div>
							</div>
						) : (
							<Empty
								className={cn(
									"border border-dashed",
									isDragging
										? "border-primary/70 bg-primary/10 shadow-[0_16px_50px_-40px_rgba(0,0,0,0.6)]"
										: "border-border/70 bg-muted/30",
								)}
							>
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<VideoAdd />
									</EmptyMedia>
									<EmptyTitle>
										{isDragging ? "Release to load the video" : "Drop zone"}
									</EmptyTitle>
									<EmptyDescription>
										Drag a video here or click to choose a file.
									</EmptyDescription>
								</EmptyHeader>
								<EmptyContent className="max-w-none">
									<div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
										<Badge variant="secondary">MP4</Badge>
										<Badge variant="secondary">MOV</Badge>
										<Badge variant="secondary">MKV</Badge>
										<Badge variant="secondary">AVI</Badge>
									</div>
									<Button asChild size="sm">
										<span>Choose file</span>
									</Button>
								</EmptyContent>
							</Empty>
						)}
						<Input
							id="video-input"
							type="file"
							accept="video/*"
							className="sr-only"
							onChange={(event) => handleFiles(event.target.files)}
						/>
					</Label>

					<div className="flex flex-col gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Logging console</CardTitle>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-65 rounded-lg border bg-muted/40">
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
								<CardDescription>{outputStatus}</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Format
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{outputFormatLabelText.toUpperCase()}
											</p>
										</div>
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Output size
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{outputSizeLabel}
											</p>
										</div>
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												MIME type
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{outputMimeType ?? "—"}
											</p>
										</div>
										<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
											<p className="text-[10px] uppercase tracking-[0.3em]">
												Duration
											</p>
											<p className="mt-1 text-sm font-medium text-foreground">
												{formatDuration(metadata?.durationSeconds ?? null)}
											</p>
										</div>
									</div>
									<div className="flex flex-wrap gap-3">
										<Button
											size="lg"
											onClick={startExtraction}
											disabled={
												!selectedFile || isExtracting || isReadingMetadata
											}
										>
											Start extraction
										</Button>
										<Button
											size="lg"
											variant="secondary"
											onClick={handleSaveResult}
											disabled={!outputBlob || isExtracting}
										>
											Save result
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
