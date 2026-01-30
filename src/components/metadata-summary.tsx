import { useTranslation } from "react-i18next";

type MetadataBoxProps = {
	label: string;
	value: string;
};

export function MetadataBox({ label, value }: MetadataBoxProps) {
	return (
		<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
			<p className="text-[10px] uppercase tracking-[0.3em]">{label}</p>
			<p className="mt-1 text-sm font-medium text-foreground">{value}</p>
		</div>
	);
}

type MetadataVideoProps = {
	durationLabel: string;
	fileSizeLabel: string;
	audioLabel: string;
	estimatedOutputLabel: string;
};

export function MetadataVideo({
	durationLabel,
	fileSizeLabel,
	audioLabel,
	estimatedOutputLabel,
}: MetadataVideoProps) {
	const { t } = useTranslation();
	return (
		<div className="grid gap-3 text-xs text-muted-foreground grid-cols-2">
			<MetadataBox label={t("duration")} value={durationLabel} />
			<MetadataBox label={t("fileSize")} value={fileSizeLabel} />
			<MetadataBox label={t("audio")} value={audioLabel} />
			<MetadataBox label={t("estimatedOutput")} value={estimatedOutputLabel} />
		</div>
	);
}

type MetadataAudioProps = {
	mimeTypeLabel: string;
	outputSizeLabel: string;
};

export function MetadataAudio({
	mimeTypeLabel,
	outputSizeLabel,
}: MetadataAudioProps) {
	const { t } = useTranslation();
	return (
		<div className="grid gap-3 text-xs text-muted-foreground grid-cols-2">
			<MetadataBox label={t("mimeType")} value={mimeTypeLabel} />
			<MetadataBox label={t("outputSize")} value={outputSizeLabel} />
		</div>
	);
}
