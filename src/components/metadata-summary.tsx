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
	return (
		<div className="grid gap-3 text-xs text-muted-foreground grid-cols-2">
			<MetadataBox label="Duration" value={durationLabel} />
			<MetadataBox label="File size" value={fileSizeLabel} />
			<MetadataBox label="Audio" value={audioLabel} />
			<MetadataBox label="Est. output" value={estimatedOutputLabel} />
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
	return (
		<div className="grid gap-3 text-xs text-muted-foreground grid-cols-2">
			<MetadataBox label="MIME type" value={mimeTypeLabel} />
			<MetadataBox label="Output size" value={outputSizeLabel} />
		</div>
	);
}
