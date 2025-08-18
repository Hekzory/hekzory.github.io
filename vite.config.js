import { defineConfig } from "vite";
import { resolve } from "path";
import { compression, defineAlgorithm } from "vite-plugin-compression2";
import { createHtmlPlugin } from "vite-plugin-html";
import htmlMetaPlugin from "./vite-plugin-html-meta";
import zlib from "node:zlib";

export default defineConfig({
    appType: "mpa",
    plugins: [
        htmlMetaPlugin(),
        createHtmlPlugin({
            minify: true,
        }),
        compression({
            algorithms: [
              defineAlgorithm('brotliCompress', {
                params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 12
                  }
              }), 
              defineAlgorithm('gzip', { level: 9 })],
            exclude: [/\.(br)$/, /\.(gz)$/],
        }),
    ],
    json: {
        stringify: true,
    },
    build: {
        modulePreload: { polyfill: false },
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                notfoundpage: resolve(__dirname, "404.html"),
            },
        },
        target: "baseline-widely-available",
        minify: "terser",
        cssMinify: "esbuild",
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 5,
                ecma: 2023,
                module: true,
                toplevel: true,
                keep_fargs: false,
                booleans_as_integers: true,
                unsafe_arrows: true,
                unsafe_comps: true,
                unsafe_math: true,
            },
            mangle: {
                toplevel: true,
                module: true,
            },
            format: {
                comments: false,
                ecma: 2023,
            },
        },
    },
});
