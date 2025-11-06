import { createWriteStream } from "node:fs";
import { access, constants, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buffer } from "node:stream/consumers";
import yauzl, { Entry } from "yauzl-promise";
import { LookupByPath } from "@rushstack/lookup-by-path";
import { limitFunction } from "p-limit";
import { pipeline } from "node:stream/promises";

import * as native from "../native/index.js";

function getDataHome(): string {
    // Check XDG_DATA_HOME first (Linux standard)
    if (process.env.XDG_DATA_HOME) {
        return process.env.XDG_DATA_HOME;
    }

    const platform = os.platform();
    const home = os.homedir();

    switch (platform) {
        case "darwin": // macOS
            return path.join(home, "Library", "Application Support");
        case "win32": // Windows
            return process.env.APPDATA || path.join(home, "AppData", "Roaming");
        default: // Linux and others
            return path.join(home, ".local", "share");
    }
}

const TREE_MAGIC_URL_DEFAULT =
    "https://github.com/hechang27-sprt/build-shared-mime-info/releases/download/db-20251031/mime-database.zip";
const TREE_MAGIC_URL = process.env.TREE_MAGIC_URL ?? TREE_MAGIC_URL_DEFAULT;

const TREE_MAGIC_DIR = process.env.TREE_MAGIC_DIR;
const DEFAULT_MAGIC_DIR = path.join(getDataHome(), "tree_magic_db");

const XDG_DATA_DIRS =
    process.env.XDG_DATA_DIRS ?? "/usr/local/share/:/usr/share/";
const XDG_DATA_HOME =
    process.env.XDG_DATA_HOME ??
    (process.env.HOME
        ? path.join(process.env.HOME, ".local", "share")
        : undefined);
const MACOS_DATA_DIR = "/opt/homebrew/share/";
const MINGW_DATA_DIR = String.raw`C:\msys64\mingw64`;
const REQUIRED_FILES = new Set(["magic", "aliases", "subclasses"]);

async function downloadMimeDB(): Promise<Buffer | undefined> {
    let buf: Buffer | undefined;

    let retries = 3;
    let timeoutSeconds = 5;
    while (!buf && retries > 0) {
        try {
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`Timed out in ${timeoutSeconds}s`)),
                    timeoutSeconds * 1000
                )
            );
            buf = await Promise.race([
                timeout,
                fetch(TREE_MAGIC_URL).then((resp) =>
                    resp.body ? buffer(resp.body) : undefined
                ),
            ]);
        } catch (err) {
            console.error(`Download Failed: ${err}`);

            if (retries) {
                console.warn(`Retrying ...`);
            }
            retries -= 1;
        }
    }

    return buf;
}

async function unzipFromBuffer(
    buf: Buffer,
    magicDir: string,
    concurrency: number
) {
    const unzip = await yauzl.fromBuffer(buf);
    const trie = new LookupByPath<Entry>(undefined, "/");
    const potentialBaseDir = new Set<string>();

    try {
        for await (const entry of unzip) {
            if (!entry.filename.endsWith("/")) {
                trie.setItem(entry.filename, entry);
                if (REQUIRED_FILES.has(path.basename(entry.filename))) {
                    potentialBaseDir.add(path.dirname(entry.filename));
                }
            }
        }

        const arcBaseDir =
            potentialBaseDir.size == 1
                ? potentialBaseDir.values().find(() => true)
                : potentialBaseDir
                      .values()
                      .filter((base) => {
                          const files = trie.getNodeAtPrefix(base)?.children;
                          return new Set(files?.keys()).isSupersetOf(
                              REQUIRED_FILES
                          );
                      })
                      .find(() => true);

        if (!arcBaseDir) {
            console.error(
                "Cannot find valid magic files in downloaded archive."
            );

            return;
        }

        await Promise.all(
            Iterator.from(trie.entries(arcBaseDir))
                .map(
                    limitFunction(
                        async ([_, entry]) => {
                            const filePath = path.join(
                                magicDir,
                                path.relative(arcBaseDir, entry.filename)
                            );
                            await mkdir(path.dirname(filePath), {
                                recursive: true,
                            });
                            const writeStream = createWriteStream(filePath);
                            const readStream = await entry.openReadStream();
                            await pipeline(readStream, writeStream);
                        },
                        { concurrency }
                    )
                )
                .toArray()
        );
    } finally {
        unzip.close();
    }
}

async function init() {
    const isValidMagicDir = (dir: string) =>
        Promise.all(
            REQUIRED_FILES.values().map((name) =>
                access(path.join(dir, name), constants.F_OK | constants.R_OK)
            )
        )
            .then(() => true)
            .catch(() => false);

    if (TREE_MAGIC_DIR && (await isValidMagicDir(TREE_MAGIC_DIR))) {
        return;
    } else if (await isValidMagicDir(DEFAULT_MAGIC_DIR)) {
        process.env.TREE_MAGIC_DIR = DEFAULT_MAGIC_DIR;
        return;
    }

    const defaultSearchPaths = [
        XDG_DATA_DIRS,
        XDG_DATA_HOME,
        MACOS_DATA_DIR,
        MINGW_DATA_DIR,
    ].flatMap((paths) => paths?.split(path.delimiter) ?? []);
    const checkingPaths = Promise.allSettled<string>(
        defaultSearchPaths.map((base) =>
            Promise.all<void>(
                REQUIRED_FILES.values().map((name) =>
                    access(
                        path.join(base, "mime", name),
                        constants.F_OK | constants.R_OK
                    )
                )
            ).then(() => base)
        )
    );
    const checkedPaths = (await checkingPaths).flatMap((res) =>
        res.status == "fulfilled" ? [res.value] : []
    );

    if (checkedPaths.length > 0) {
        console.info(
            "Using shared-mime-info database from the following directories: "
        );
        console.info(
            checkedPaths.map((base) => path.join(base, "mime")).join("\n")
        );

        if (checkedPaths.includes(MINGW_DATA_DIR)) {
            process.env.TREE_MAGIC_DIR = MINGW_DATA_DIR;
        }
        return;
    }

    console.warn(
        `No valid paths for mime database found, start downloading from: ${TREE_MAGIC_URL}`
    );

    const buf = await downloadMimeDB();

    if (!buf) {
        console.error(
            `Failed to download shared-mime-info from: ${TREE_MAGIC_URL}`
        );
        console.error(
            "Check your internet connection or supply your own URL to TREE_MAGIC_URL environment variable."
        );

        return;
    }

    const magicDir = TREE_MAGIC_DIR ?? DEFAULT_MAGIC_DIR;

    if (TREE_MAGIC_DIR) {
        console.info(`Unzipping to TREE_MAGIC_DIR: ${magicDir}`);
    } else {
        console.info(
            `TREE_MAGIC_DIR not provided, unzipping to default location: ${magicDir}`
        );
    }

    await unzipFromBuffer(buf, magicDir, 8);

    process.env.TREE_MAGIC_DIR = magicDir;
}

const INIT = init();

export async function inferFromBuffer(bytes: Buffer): Promise<string> {
    await INIT;
    return await native.inferFromBuffer(bytes);
}

export async function inferFromPath(path: string): Promise<string | null> {
    await INIT;
    return await native.inferFromPath(path);
}

export async function matchBuffer(
    mimeType: string,
    bytes: Buffer
): Promise<boolean> {
    await INIT;
    return await native.matchBuffer(mimeType, bytes);
}

export async function matchPath(
    mimeType: string,
    path: string
): Promise<boolean> {
    await INIT;
    return await native.matchPath(mimeType, path);
}
