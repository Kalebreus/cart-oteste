import {readFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {crc32, deflateRawSync} from 'node:zlib';

// Explicit source locations keep credentials, runtime state and build output out.
const files = ['.gitignore', '.openai/hosting.json', 'README.md', 'package.json', 'index.html', 'robots.txt', 'sitemap.xml'];
const directories = ['assets', 'drizzle', 'reference', 'scripts', 'src', 'tests'];

export async function createSourceArchive(root) {
  const paths = [...files];
  async function collect(directory) {
    for (const entry of await readdir(resolve(root, directory), {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  for (const directory of directories) await collect(directory);
  paths.sort();
  const records = [], central = [];
  let offset = 0;
  for (const path of paths) {
    if (path.startsWith('/') || path.split('/').includes('..') || path.includes('\0')) throw new Error('Invalid archive path');
    const name = Buffer.from('gold-packs/' + path, 'utf8');
    const content = await readFile(resolve(root, path));
    const compressed = deflateRawSync(content);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(33, 12); // 1980-01-01, deterministic ZIP metadata.
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    records.push(local, name, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(paths.length, 8);
  end.writeUInt16LE(paths.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...records, directory, end]);
}
