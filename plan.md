1. **Import new necessary components**
   - Import `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs` in `App.tsx`
   - Import `HLS_FORMATS` from `mediabunny`
   - Import `UrlSource` from `mediabunny`

2. **Add state for handling HLS input URL**
   - Add state `hlsUrl` (string)
   - Add state `inputMode` to switch between "file" and "hls" modes (e.g., 'file' | 'hls')

3. **Update translation files**
   - Update `en.json` and `zh.json` to include texts like "File", "HLS Remux", "M3U8 URL", "Enter M3U8 URL", "Load HLS", etc.

4. **Update `mediaInput` logic**
   - If `inputMode` is "file", logic remains the same (BlobSource with `SUPPORTED_INPUT_FORMATS`).
   - If `inputMode` is "hls", handle fetching HLS using `UrlSource` with `HLS_FORMATS`. Wait, for `UrlSource`, it requires an input URL.
   - We might need an explicit load action for HLS URL, e.g., when clicking "Load HLS", update `mediaInput`. Actually, since it creates an `Input` instance based on `hlsUrl`, we can use `useEffect` or an explicit action to create `MediaInput` for HLS.

5. **Update UI**
   - Wrap the main content (file drag & drop, file selection, etc) in `Tabs` to separate File Extraction and HLS Remux.
   - For HLS Tab: Input field for `m3u8` URL, "Load" button.
   - Show similar UI for HLS Remux with `metadata`, `start extraction/remux`, etc.

6. **Implement HLS Remux Logic**
   - In HLS mode, the conversion needs to support both video and audio tracks. HLS Remux means downloading and changing the container, usually to `MP4` or `MKV`.
   - Update `startExtraction` or create `startHlsRemux`.
     - Output format can be `Mp4OutputFormat` or `MkvOutputFormat`.
     - Do not discard video, copy video and audio.
