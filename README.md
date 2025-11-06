# tree-magic-js

Fast MIME type detection for Node.js, powered by Rust.

[![npm version](https://badge.fury.io/js/%40hechang27%2Ftree-magic-js.svg)](https://www.npmjs.com/package/@hechang27/tree-magic-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`tree-magic-js` is a simple N-API wrapper that wraps Rust crate [`tree_magic_mini`](https://crates.io/crates/tree_magic_mini), which is a high-performance MIME type detection library. It can detect file types from both file buffers and file paths.

## Installation

```bash
npm install @hechang27/tree-magic-js
```

## Quick Start

```javascript
import { inferFromBuffer, inferFromPath } from "@hechang27/tree-magic-js";
import { readFile } from "fs/promises";

// Detect MIME type from file buffer
const buffer = await readFile("example.jpg");
const mimeType = await inferFromBuffer(buffer);
console.log(mimeType); // 'image/jpeg'

// Detect MIME type from file path
const mimeType2 = await inferFromPath("./document.pdf");
console.log(mimeType2); // 'application/pdf'
```

## API Reference

### `inferFromBuffer(bytes: Buffer): Promise<string>`

Detects the MIME type of a file from its buffer contents.

**Parameters:**

- `bytes` (Buffer): The file content as a Buffer

**Returns:**

- `Promise<string>`: The detected MIME type (e.g., 'image/jpeg', 'text/plain')

**Example:**

```javascript
import { inferFromBuffer } from "@hechang27/tree-magic-js";
import { readFile } from "fs/promises";

const buffer = await readFile("photo.png");
const mimeType = await inferFromBuffer(buffer);
console.log(mimeType); // 'image/png'
```

### `inferFromPath(path: string): Promise<string | null>`

Detects the MIME type of a file from its file path.

**Parameters:**

- `path` (string): Path to the file

**Returns:**

- `Promise<string | null>`: The detected MIME type, or `null` if the file doesn't exist

**Example:**

```javascript
import { inferFromPath } from "@hechang27/tree-magic-js";

const mimeType = await inferFromPath("./video.mp4");
console.log(mimeType); // 'video/mp4'

const notFound = await inferFromPath("./nonexistent.txt");
console.log(notFound); // null
```

### `matchBuffer(mimeType: string, bytes: Buffer): Promise<boolean>`

Checks if a buffer matches a specific MIME type.

**Parameters:**

- `mimeType` (string): The MIME type to check against
- `bytes` (Buffer): The file content as a Buffer

**Returns:**

- `Promise<boolean>`: `true` if the buffer matches the MIME type, `false` otherwise

**Example:**

```javascript
import { matchBuffer } from "@hechang27/tree-magic-js";
import { readFile } from "fs/promises";

const buffer = await readFile("image.jpg");
const isJpeg = await matchBuffer("image/jpeg", buffer);
console.log(isJpeg); // true

const isPng = await matchBuffer("image/png", buffer);
console.log(isPng); // false
```

### `matchPath(mimeType: string, path: string): Promise<boolean>`

Checks if a file matches a specific MIME type.

**Parameters:**

- `mimeType` (string): The MIME type to check against
- `path` (string): Path to the file

**Returns:**

- `Promise<boolean>`: `true` if the file matches the MIME type, `false` otherwise

**Example:**

```javascript
import { matchPath } from "@hechang27/tree-magic-js";

const isVideo = await matchPath("video/mp4", "./movie.mp4");
console.log(isVideo); // true
```

## Configuration

`tree-magic-js` supports several environment variables for customization:

### `TREE_MAGIC_DIR`

Specify a custom directory where the MIME database is located or should be stored.

```bash
export TREE_MAGIC_DIR="/path/to/custom/mime/database"
```

### `TREE_MAGIC_URL`

Specify a custom URL to download the MIME database from.

```bash
export TREE_MAGIC_URL="https://custom-server.com/mime-database.zip"
```

### `XDG_DATA_HOME`

Override the XDG data home directory (Linux/Unix).

```bash
export XDG_DATA_HOME="/custom/data/home"
```

### `XDG_DATA_DIRS`

Override the XDG data directories (Linux/Unix).

```bash
export XDG_DATA_DIRS="/usr/local/share:/usr/share:/custom/share"
```

## How It Works

On first use, `tree-magic-js` automatically:

1. **Searches for existing MIME databases** in standard system locations:
    - Linux: `/usr/share/mime`, `/usr/local/share/mime`, `~/.local/share/mime`
    - macOS: `/opt/homebrew/share/mime`
    - ~~Windows: `C:\msys64\mingw64\share\mime`~~

    Or uses the mime database in provided location if `TREE_MAGIC_DIR` is present and valid

2. **Downloads the database** if not found locally:
    - Downloads from the configured URL (default: [GitHub release](https://github.com/hechang27-sprt/build-shared-mime-info/releases/download/db-20251031/mime-database.zip))
    - Extracts to platform-appropriate data directory and set the `TREE_MAGIC_DIR` to point to that location.

3. The underlying rust library will use the MIME databases specified by `TREE_MAGIC_DIR`, if not present, it will attempt to search one of the system paths. Without the MIME database present, the library can only differentiate between `text/plain` and `binary/octet-stream`.

## Platform Support

`tree-magic-js` provides pre-built native binaries for:

- **macOS**: x64, ARM64 (Apple Silicon)
- **Windows**: x64, x86, ARM64
- **Linux**: x64, ARM64, ARMv7 (glibc and musl)
- **FreeBSD**: x64, ARM64
- **Android**: ARM64, ARMv7

### System Requirements

- **Node.js**: Version 22 or higher
- **Internet connection**: Required for initial database download (if not already present)

### Custom Database

To use a custom MIME database:

```bash
# Point to your custom database directory
export TREE_MAGIC_DIR="/path/to/custom/mime/db"

# Or provide a custom download URL
# default URL is https://github.com/hechang27-sprt/build-shared-mime-info/releases/download/db-20251031/mime-database.zip
export TREE_MAGIC_URL="https://your-server.com/custom-mime-db.zip"
```

## Examples

### File Upload Validation

```javascript
import { inferFromBuffer, matchBuffer } from "@hechang27/tree-magic-js";

async function validateUpload(fileBuffer, allowedType) {
    if (await matchBuffer(allowedType, fileBuffer)) {
        return { valid: true, buf: fileBuffer };
    }

    return { valid: false };
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/hechang27-sprt/tree-magic-js)
- [tree-magic-mini](https://crates.io/crates/tree_magic_mini)
- [NPM Package](https://www.npmjs.com/package/@hechang27/tree-magic-js)
- [Issues](https://github.com/hechang27-sprt/tree-magic-js/issues)
