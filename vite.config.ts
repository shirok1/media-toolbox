import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { bundleStats } from "rollup-plugin-bundle-stats";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		bundleStats(),
		VitePWA({
			registerType: "autoUpdate",
			injectRegister: "auto",
			manifest: {
				name: "Media Toolbox",
				short_name: "MediaToolbox",
				description: "A browser-based audio extractor built with Mediabunny.",
				theme_color: "#252525",
				background_color: "#252525",
				display: "standalone",
				icons: [
					{
						src: "/icon-192x192.svg",
						sizes: "192x192",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
					{
						src: "/icon-512x512.svg",
						sizes: "512x512",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
			},
		}),
	],
	build: {
		rollupOptions: {
			output: {
				assetFileNames: "assets/[name].[hash][extname]",
				chunkFileNames: "assets/[name].[hash].js",
				entryFileNames: "assets/[name].[hash].js",
				codeSplitting: {
					groups: [
						{
							name: "react-vendor",
							test: /node_modules[\\/]react/,
							priority: 25,
						},
						{
							name: "mediabunny-vendor",
							test: /node_modules[\\/]mediabunny/,
							priority: 20,
						},
						{
							name: "ui-vendor",
							test: /node_modules[\\/](@radix-ui)/,
							priority: 15,
						},
						{
							name: "vendor",
							test: /node_modules/,
							priority: 10,
						},
						{
							name: "common",
							minShareCount: 2,
							minSize: 10000,
							priority: 5,
						},
					],
				},
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
