import { defineConfig } from "vite";
import { resolve } from "path";
import { compression } from "vite-plugin-compression2";
import { createHtmlPlugin } from "vite-plugin-html";
import htmlMetaPlugin from "./vite-plugin-html-meta";

export default defineConfig({
    appType: "mpa",
    plugins: [
        htmlMetaPlugin(),
        createHtmlPlugin({
            minify: true,
        }),
        compression({
            algorithm: "brotliCompress",
            exclude: [/\.(br)$/, /\.(gz)$/],
            compressionOptions: {
                level: 9,
            },
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
        target: "es2021",
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 3,
                ecma: 2021,
                module: true,
                toplevel: true,
            },
            mangle: {
                toplevel: true,
                module: true,
            },
            format: {
                comments: false,
                ecma: 2021,
            },
        },
    },
});
