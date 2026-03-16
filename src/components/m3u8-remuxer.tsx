import {
	BlobSource,
	BufferTarget,
	Conversion,
	Input as MediaInput,
	MPEG_TS,
	Mp4OutputFormat,
	Output,
} from "mediabunny";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatTimestamp = () =>
	new Date().toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

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

export function M3U8Remuxer() {
	const { t } = useTranslation();
	const [m3u8Url, setM3u8Url] = useState("");
	const [logs, setLogs] = useState<string[]>([]);
	const [isRemuxing, setIsRemuxing] = useState(false);
	const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
	const [outputFileName, setOutputFileName] = useState<string | null>(null);

	const appendLog = useCallback((message: string) => {
		setLogs((prev) =>
			[`${formatTimestamp()} ${message}`, ...prev].slice(0, 50),
		);
	}, []);

	const startRemuxing = async () => {
		if (!m3u8Url) return;

		setIsRemuxing(true);
		setOutputBlob(null);
		setOutputFileName(null);
		appendLog(t("startingRemux") || "Starting M3U8 remuxing...");

		try {
			appendLog(`Fetching M3U8 playlist from: ${m3u8Url}`);
			const response = await fetch(m3u8Url);
			if (!response.ok) {
				throw new Error(`Failed to fetch M3U8: ${response.statusText}`);
			}
			const m3u8Text = await response.text();

			const lines = m3u8Text.split("\n").map((l) => l.trim());
			const segmentUrls: string[] = [];
			for (const line of lines) {
				if (line && !line.startsWith("#")) {
					try {
						const url = new URL(line, m3u8Url).href;
						segmentUrls.push(url);
					} catch (_e) {
						segmentUrls.push(line);
					}
				}
			}

			if (segmentUrls.length === 0) {
				throw new Error(
					"No segment URLs found in the M3U8 playlist. If this is a master playlist, it is not currently supported.",
				);
			}

			appendLog(`Found ${segmentUrls.length} segments. Downloading...`);

			const buffers: Uint8Array[] = [];
			for (let i = 0; i < segmentUrls.length; i++) {
				const segUrl = segmentUrls[i];
				appendLog(`Downloading segment ${i + 1}/${segmentUrls.length}...`);

				const segResponse = await fetch(segUrl);
				if (!segResponse.ok) {
					throw new Error(
						`Failed to fetch segment ${i}: ${segResponse.statusText}`,
					);
				}
				const segBuffer = await segResponse.arrayBuffer();
				buffers.push(new Uint8Array(segBuffer));
			}

			appendLog("Concatenating segments...");
			const totalLength = buffers.reduce((acc, val) => acc + val.length, 0);
			const concatenated = new Uint8Array(totalLength);
			let offset = 0;
			for (const buffer of buffers) {
				concatenated.set(buffer, offset);
				offset += buffer.length;
			}

			const concatenatedBlob = new Blob([concatenated], {
				type: "video/mp2t",
			});

			appendLog("Remuxing to MP4 using Mediabunny...");

			const mediaInput = new MediaInput({
				formats: [MPEG_TS],
				source: new BlobSource(concatenatedBlob),
			});

			const primaryVideo = await mediaInput.getPrimaryVideoTrack();
			if (!primaryVideo) {
				throw new Error("No video track found in the concatenated stream.");
			}
			const primaryAudio = await mediaInput.getPrimaryAudioTrack();

			const outputFormat = new Mp4OutputFormat();
			const output = new Output({
				format: outputFormat,
				target: new BufferTarget(),
			});

			const conversion = await Conversion.init({
				input: mediaInput,
				output,
				video: (track) =>
					track.number === primaryVideo.number
						? { codec: primaryVideo.codec ?? undefined }
						: { discard: true },
				audio: (track) => {
					if (!primaryAudio) return { discard: true };
					return track.number === primaryAudio.number
						? { codec: primaryAudio.codec ?? undefined }
						: { discard: true };
				},
			});

			if (!conversion.isValid) {
				throw new Error("Remuxing configuration is invalid or unsupported.");
			}

			await conversion.execute();

			if (!output.target.buffer) {
				throw new Error("Output buffer is empty.");
			}

			const finalBlob = new Blob([output.target.buffer], {
				type: outputFormat.mimeType,
			});
			const fileName = "remuxed.mp4";

			setOutputBlob(finalBlob);
			setOutputFileName(fileName);
			appendLog(
				(t("remuxComplete") || "Remuxing complete.") +
					` (${formatBytes(finalBlob.size)})`,
			);
		} catch (error) {
			appendLog(
				(t("remuxFailed") || "Remuxing failed:") +
					" " +
					(error instanceof Error ? error.message : t("unknownError")),
			);
		} finally {
			setIsRemuxing(false);
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

	const outputStatus = isRemuxing
		? t("remuxing") || "Remuxing..."
		: outputBlob
			? t("readyToSave")
			: t("waitingToStart");

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<Card className="h-fit">
				<CardHeader>
					<CardTitle>{t("m3u8Input") || "M3U8 Input"}</CardTitle>
					<CardDescription>
						{t("enterM3u8Url") ||
							"Enter the URL of an M3U8 playlist to remux into an MP4 file."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="m3u8-url">M3U8 URL</Label>
						<Input
							id="m3u8-url"
							type="url"
							placeholder="https://example.com/stream.m3u8"
							value={m3u8Url}
							onChange={(e) => setM3u8Url(e.target.value)}
						/>
					</div>
				</CardContent>
			</Card>

			<div className="flex flex-col gap-6">
				<Card>
					<CardHeader>
						<CardTitle>{t("output")}</CardTitle>
						<CardDescription>{outputStatus}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-y-4 border rounded-lg p-4 bg-muted/40">
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										{t("outputSize")}
									</p>
									<p className="text-sm font-medium">
										{outputBlob ? formatBytes(outputBlob.size) : "—"}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										{t("mimeType")}
									</p>
									<p className="text-sm font-medium">
										{outputBlob ? "video/mp4" : "—"}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-3">
								<Button
									size="lg"
									onClick={startRemuxing}
									disabled={!m3u8Url || isRemuxing}
								>
									{t("startRemuxing") || "Start Remuxing"}
								</Button>
								<Button
									size="lg"
									variant="secondary"
									onClick={handleSaveResult}
									disabled={!outputBlob || isRemuxing}
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
	);
}
