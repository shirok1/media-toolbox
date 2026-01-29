import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { VideoAdd } from "@carbon/icons-react";
import {
	AdtsOutputFormat,
	type AudioCodec,
	BlobSource,
	BufferTarget,
	Conversion,
	FlacOutputFormat,
	MATROSKA,
	Input as MediaInput,
	MkvOutputFormat,
	MovOutputFormat,
	MP4,
	MPEG_TS,
	Mp3OutputFormat,
	Mp4OutputFormat,
	OggOutputFormat,
	Output,
	QTFF,
	WavOutputFormat,
	WEBM,
} from "mediabunny";
import { MetadataAudio, MetadataVideo } from "@/components/metadata-summary";
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
};

const SUPPORTED_INPUT_FORMATS = [MP4, QTFF, MATROSKA, WEBM, MPEG_TS];

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
	const metadataRequestId = useRef(0);

	const fileSummary = useMemo(() => {
		if (!selectedFile) {
			return "No video loaded yet.";
		}

		return `${selectedFile.name} • ${formatBytes(selectedFile.size)}`;
	}, [selectedFile]);

	const mediaInput = useMemo(() => {
		if (!selectedFile) {
			return null;
		}

		return new MediaInput({
			formats: SUPPORTED_INPUT_FORMATS,
			source: new BlobSource(selectedFile),
		});
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

	const audioLabel = useMemo(() => {
		if (!metadata?.audio) {
			return "—";
		}

		const sampleRateLabel = metadata.audio.sampleRate
			? `${Math.round(metadata.audio.sampleRate / 1000)} kHz`
			: "—";

		return `${metadata.audio.codec ?? "unknown"} • ${sampleRateLabel}`;
	}, [metadata]);

	const appendLog = useCallback((message: string) => {
		setLogs((prev) =>
			[`${formatTimestamp()} ${message}`, ...prev].slice(0, 50),
		);
	}, []);

	const readMetadata = useCallback(
		async (input: MediaInput) => {
			const requestId = metadataRequestId.current + 1;
			metadataRequestId.current = requestId;
			setIsReadingMetadata(true);
			appendLog("Reading metadata...");

			try {
				const [format, durationSeconds, mimeType, audioTrack] =
					await Promise.all([
						input.getFormat(),
						input.computeDuration(),
						input.getMimeType(),
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
				});

				appendLog("Metadata ready.");
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
				if (metadataRequestId.current === requestId) {
					setIsReadingMetadata(false);
				}
			}
		},
		[appendLog],
	);

	useEffect(() => {
		setMetadata(null);
		if (!mediaInput) {
			return;
		}

		readMetadata(mediaInput);
	}, [mediaInput, readMetadata]);

	const handleFiles = (files: FileList | null) => {
		const file = files?.[0];
		if (!file) {
			return;
		}

		setSelectedFile(file);
		setOutputBlob(null);
		setOutputFileName(null);
		setOutputMimeType(null);
		appendLog(`Loaded ${file.name} (${formatBytes(file.size)})`);
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
		if (!selectedFile || !mediaInput) {
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
		appendLog("Starting audio extraction...");

		try {
			const primaryAudio = await mediaInput.getPrimaryAudioTrack();
			if (!primaryAudio) {
				appendLog("No audio track detected. Please choose another file.");
				return;
			}
			if (!primaryAudio.codec) {
				appendLog("No audio codec detected. Please choose another file.");
				return;
			}

			const outputFormat = selectOutputFormat(primaryAudio.codec);
			const output = new Output({
				format: outputFormat,
				target: new BufferTarget(),
			});

			appendLog(
				`Using ${outputFormat.fileExtension} container (${
					primaryAudio.codec ?? "unknown codec"
				})`,
			);

			const conversion = await Conversion.init({
				input: mediaInput,
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

			const blob = new Blob([output.target.buffer!], {
				type: outputFormat.mimeType,
			});
			const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
			const fileName = `${baseName || "audio"}${
				outputFormat.fileExtension || ""
			}`;

			setOutputBlob(blob);
			setOutputFileName(fileName);
			setOutputMimeType(outputFormat.mimeType);
			appendLog(`Extraction complete (${formatBytes(blob.size)}).`);
		} catch (error) {
			appendLog(
				`Extraction failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		} finally {
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
	const outputStatus = isExtracting
		? "Extracting audio..."
		: outputBlob
			? "Ready to save"
			: "Waiting to start";

	return (
		<div className="min-h-svh bg-background text-foreground">
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
									<MetadataVideo
										durationLabel={formatDuration(
											metadata?.durationSeconds ?? null,
										)}
										fileSizeLabel={formatBytes(selectedFile.size)}
										audioLabel={audioLabel}
										estimatedOutputLabel={
											estimatedOutputSize
												? formatBytes(estimatedOutputSize)
												: "—"
										}
									/>
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
										{SUPPORTED_INPUT_FORMATS.map((format) => (
											<Badge variant="secondary">
												{format.mimeType.split("/").at(-1)}
											</Badge>
										))}
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
								<CardTitle>Output</CardTitle>
								<CardDescription>{outputStatus}</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<MetadataAudio
										mimeTypeLabel={outputMimeType ?? "—"}
										outputSizeLabel={outputSizeLabel}
									/>
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

						<ScrollArea className="h-65 rounded-lg border bg-muted/40">
							<div className="space-y-2 p-4 font-mono text-xs text-primary">
								{logs.map((log, index) => (
									<p key={`${log}-${index}`} className="leading-relaxed">
										{log}
									</p>
								))}
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
