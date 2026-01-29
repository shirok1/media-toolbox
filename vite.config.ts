import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { bundleStats } from "rollup-plugin-bundle-stats";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss(), bundleStats()],
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
