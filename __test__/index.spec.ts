import test from "ava";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "crosspath";
import { buffer } from "node:stream/consumers";
import { inferFromBuffer } from "tree-magic-js";

const baseDir = "data";

async function* walkDir(
    root: string
): AsyncGenerator<{ mimeType: string; buffer: Buffer }> {
    async function* inner(
        base: string
    ): AsyncGenerator<{ mimeType: string; buffer: Buffer }> {
        const entries = await fs.readdir(base, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.endsWith("skip-test")) continue;

            const entryPath = path.join(base, entry.name);
            if (entry.isFile()) {
                yield {
                    mimeType: path.relative(root, entryPath),
                    buffer: await buffer(createReadStream(entryPath)),
                };
            } else if (entry.isDirectory()) {
                yield* inner(entryPath);
            }
        }
    }

    yield* inner(root);
}

const testData = [];

for await (const test of walkDir(baseDir)) {
    // console.debug(test.mimeType);
    testData.push(test);
}

for (const { mimeType: expected, buffer } of testData) {
    test(`Testing ${expected}`, async (t) => {
        const actual = await inferFromBuffer(buffer);
        t.is(actual, expected);
    });
}
