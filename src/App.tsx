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
	HLS_FORMATS,
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
	UrlSource,
	WavOutputFormat,
	WEBM,
} from "mediabunny";
import { useTranslation } from "react-i18next";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
	const { t } = useTranslation();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [activeTab, setActiveTab] = useState<"file" | "hls">("file");
	const [hlsUrlInput, setHlsUrlInput] = useState("");
	const [activeHlsUrl, setActiveHlsUrl] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);

	// Initialize logs in useEffect to access t
	// biome-ignore lint/correctness/useExhaustiveDependencies: We only want to set initial logs once
	useEffect(() => {
		setLogs([
			`${formatTimestamp()} ${t("readyToExtract")}`,
			`${formatTimestamp()} ${t("waitingForInput")}`,
		]);
	}, []);

	const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
	const [isReadingMetadata, setIsReadingMetadata] = useState(false);
	const [isExtracting, setIsExtracting] = useState(false);
	const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
	const [outputFileName, setOutputFileName] = useState<string | null>(null);
	const [outputMimeType, setOutputMimeType] = useState<string | null>(null);
	const metadataRequestId = useRef(0);

	const fileSummary = useMemo(() => {
		if (activeTab === "hls") {
			if (!activeHlsUrl) return t("noVideoLoaded");
			try {
				const url = new URL(activeHlsUrl);
				return url.hostname;
			} catch {
				return activeHlsUrl;
			}
		}

		if (!selectedFile) {
			return t("noVideoLoaded");
		}

		return t("loadedFile", {
			file: selectedFile.name,
			size: formatBytes(selectedFile.size),
		});
	}, [selectedFile, activeTab, activeHlsUrl, t]);

	const mediaInput = useMemo(() => {
		if (activeTab === "hls") {
			if (!activeHlsUrl) return null;
			return new MediaInput({
				formats: HLS_FORMATS,
				source: new UrlSource(activeHlsUrl),
			});
		}

		if (!selectedFile) {
			return null;
		}

		return new MediaInput({
			formats: SUPPORTED_INPUT_FORMATS,
			source: new BlobSource(selectedFile),
		});
	}, [selectedFile, activeTab, activeHlsUrl]);

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

		return `${metadata.audio.codec ?? t("unknown")} • ${sampleRateLabel}`;
	}, [metadata, t]);

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
			appendLog(t("readingMetadata"));

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

				appendLog(t("metadataReady"));
			} catch (error) {
				if (metadataRequestId.current !== requestId) {
					return;
				}
				setMetadata(null);
				appendLog(
					t("metadataReadFailed", {
						error: error instanceof Error ? error.message : t("unknownError"),
					}),
				);
			} finally {
				if (metadataRequestId.current === requestId) {
					setIsReadingMetadata(false);
				}
			}
		},
		[appendLog, t],
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
		appendLog(
			t("loadedFile", { file: file.name, size: formatBytes(file.size) }),
		);
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
		if (!mediaInput) {
			return;
		}

		if (activeTab === "file" && !selectedFile) {
			return;
		}

		if (activeTab === "hls" && !activeHlsUrl) {
			return;
		}

		if (!metadata?.audio) {
			appendLog(t("noAudioTrack"));
			return;
		}

		setIsExtracting(true);
		setOutputBlob(null);
		setOutputFileName(null);
		setOutputMimeType(null);

		if (activeTab === "hls") {
			appendLog(t("remuxing"));
		} else {
			appendLog(t("startingExtraction"));
		}

		try {
			const primaryAudio = await mediaInput.getPrimaryAudioTrack();
			if (!primaryAudio) {
				appendLog(t("noAudioTrack"));
				return;
			}
			if (!primaryAudio.codec) {
				appendLog(t("noAudioCodec"));
				return;
			}

			const primaryVideo =
				activeTab === "hls" ? await mediaInput.getPrimaryVideoTrack() : null;

			const outputFormat =
				activeTab === "hls"
					? new Mp4OutputFormat()
					: selectOutputFormat(primaryAudio.codec);
			const output = new Output({
				format: outputFormat,
				target: new BufferTarget(),
			});

			appendLog(
				t("usingContainer", {
					format: outputFormat.fileExtension,
					codec: primaryAudio.codec ?? t("unknownCodec"),
				}),
			);

			const conversion = await Conversion.init({
				input: mediaInput,
				output,
				video:
					activeTab === "hls" && primaryVideo
						? (track) =>
								track.number === primaryVideo.number
									? { codec: primaryVideo.codec ?? undefined }
									: { discard: true }
						: { discard: true },
				audio: (track) =>
					track.number === primaryAudio.number
						? { codec: primaryAudio.codec ?? undefined }
						: { discard: true },
			});
			if (!conversion.isValid) {
				appendLog(t("extractionFailedUnsupported"));
				return;
			}

			await conversion.execute();

			const blob = new Blob([output.target.buffer!], {
				type: outputFormat.mimeType,
			});

			let baseName = "audio";
			if (activeTab === "file" && selectedFile) {
				baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
			} else if (activeTab === "hls" && activeHlsUrl) {
				try {
					const url = new URL(activeHlsUrl);
					const pathParts = url.pathname.split("/").filter(Boolean);
					const lastPart = pathParts[pathParts.length - 1];
					if (lastPart) {
						baseName = lastPart.replace(/\.[^/.]+$/, "") + "-remux";
					} else {
						baseName = "hls-remux";
					}
				} catch {
					baseName = "hls-remux";
				}
			}

			const fileName = `${baseName || "audio"}${
				outputFormat.fileExtension || ""
			}`;

			setOutputBlob(blob);
			setOutputFileName(fileName);
			setOutputMimeType(outputFormat.mimeType);
			appendLog(t("extractionComplete", { size: formatBytes(blob.size) }));
		} catch (error) {
			appendLog(
				t("extractionFailed", {
					error: error instanceof Error ? error.message : t("unknownError"),
				}),
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

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
			if (e.matches) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		};

		handleChange(mediaQuery);

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	const outputSizeLabel = outputBlob ? formatBytes(outputBlob.size) : "—";
	const outputStatus = isExtracting
		? t("extracting")
		: outputBlob
			? t("readyToSave")
			: t("waitingToStart");

	return (
		<div className="min-h-svh bg-background text-foreground">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 lg:px-10">
				<header className="flex flex-col gap-4">
					<div className="space-y-2">
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
							{t("audioExtractor")}
						</h1>
					</div>
				</header>

				<Separator />

				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as "file" | "hls")}
					className="w-full"
				>
					<TabsList className="grid w-full grid-cols-2 max-w-sm mb-6">
						<TabsTrigger value="file">{t("fileMode")}</TabsTrigger>
						<TabsTrigger value="hls">{t("hlsMode")}</TabsTrigger>
					</TabsList>

					<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
						<div>
							<TabsContent value="file" className="mt-0">
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
														{t("currentFile")}
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
														{t("readingMetadata")}
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
													{isDragging ? t("releaseToLoad") : t("dropZone")}
												</EmptyTitle>
												<EmptyDescription>{t("dragOrClick")}</EmptyDescription>
											</EmptyHeader>
											<EmptyContent className="max-w-none">
												<div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
													{SUPPORTED_INPUT_FORMATS.map((format) => (
														<Badge variant="secondary" key={format.mimeType}>
															{format.mimeType.split("/").at(-1)}
														</Badge>
													))}
												</div>
												<Button asChild size="sm">
													<span>{t("chooseFile")}</span>
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
							</TabsContent>

							<TabsContent value="hls" className="mt-0">
								<Card className="border-dashed bg-muted/30">
									<CardHeader>
										<CardTitle className="text-lg">{t("hlsUrl")}</CardTitle>
										<CardDescription>{t("hlsMode")}</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex gap-2">
											<Input
												type="url"
												placeholder={t("hlsUrlPlaceholder")}
												value={hlsUrlInput}
												onChange={(e) => setHlsUrlInput(e.target.value)}
											/>
											<Button
												onClick={() => {
													setActiveHlsUrl(hlsUrlInput);
													setOutputBlob(null);
													setOutputFileName(null);
													setOutputMimeType(null);
												}}
												disabled={!hlsUrlInput}
											>
												{t("loadHls")}
											</Button>
										</div>

										{activeHlsUrl && (
											<div className="mt-6">
												<div className="w-full space-y-4 text-left">
													<div>
														<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
															{t("currentFile")}
														</p>
														<p className="mt-2 text-base font-semibold break-all">
															{fileSummary}
														</p>
													</div>
													<MetadataVideo
														durationLabel={formatDuration(
															metadata?.durationSeconds ?? null,
														)}
														fileSizeLabel="—"
														audioLabel={audioLabel}
														estimatedOutputLabel={
															estimatedOutputSize
																? formatBytes(estimatedOutputSize)
																: "—"
														}
													/>
													{isReadingMetadata ? (
														<p className="text-xs text-muted-foreground">
															{t("readingMetadata")}
														</p>
													) : null}
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							</TabsContent>
						</div>

						<div className="flex flex-col gap-6">
							<Card>
								<CardHeader>
									<CardTitle>
										{activeTab === "hls" ? t("hlsRemuxer") : t("output")}
									</CardTitle>
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
													isExtracting ||
													isReadingMetadata ||
													(activeTab === "file" && !selectedFile) ||
													(activeTab === "hls" && !activeHlsUrl)
												}
											>
												{activeTab === "hls"
													? t("startRemux")
													: t("startExtraction")}
											</Button>
											<Button
												size="lg"
												variant="secondary"
												onClick={handleSaveResult}
												disabled={!outputBlob || isExtracting}
											>
												{t("saveResult")}
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
				</Tabs>
			</div>
		</div>
	);
}

export default App;
