import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';

const AAD = Buffer.from('dorra-airports-save-v1');

/** Authenticated server save. This directory must never be served over HTTP. */
export class AirportStore {
  constructor(directory) {
    this.directory = path.resolve(directory);
    this.file = path.join(this.directory, 'career.v1.enc');
    this.backup = path.join(this.directory, 'career.v1.backup.enc');
    this.lockPath = path.join(this.directory, 'server.lock');
    this.key = null;
    this.recovered = false;
    this.lock = null;
  }

  async open() {
    await fs.mkdir(this.directory, {recursive: true, mode: 0o700});
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        this.lock = await fs.open(this.lockPath, 'wx', 0o600);
        await this.lock.writeFile(JSON.stringify({pid: process.pid}));
        break;
      } catch (error) {
        if (error.code !== 'EEXIST' || attempt) throw new Error('The airport save is already open in another local server.');
        let owner;
        try { owner = JSON.parse(await fs.readFile(this.lockPath, 'utf8')); }
        catch { throw new Error('The airport save lock is unreadable. Close other Dorra servers before recovering it.'); }
        let live = true;
        try { process.kill(owner.pid, 0); } catch (check) { if (check.code === 'ESRCH') live = false; }
        if (live) throw new Error('The airport save is already open in another local server.');
        await fs.unlink(this.lockPath);
      }
    }
    const keyPath = path.join(this.directory, 'installation.key');
    try { this.key = await fs.readFile(keyPath); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const existing = await Promise.all([this.file, this.backup].map(file => fs.access(file).then(() => true, () => false)));
      if (existing.some(Boolean)) throw new Error('The airport encryption key is missing. Restore the original installation key; saved progress has not been reset.');
      this.key = randomBytes(32);
      const handle = await fs.open(keyPath, 'wx', 0o600);
      try { await handle.writeFile(this.key); await handle.sync(); } finally { await handle.close(); }
    }
    if (this.key.length !== 32) throw new Error('The airport encryption key is invalid.');
    return this;
  }

  encode(value) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(AAD);
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return JSON.stringify({version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64')});
  }

  decode(raw) {
    const value = JSON.parse(raw);
    if (value.version !== 1) throw new Error('Unsupported airport save version.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(value.iv, 'base64'));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
  }

  async read() {
    const copies = await Promise.all([this.file, this.backup].map(async file => {
      try { const raw = await fs.readFile(file, 'utf8'); return {file, raw, value: this.decode(raw)}; }
      catch (error) { return {file, missing: error.code === 'ENOENT'}; }
    }));
    const valid = copies.filter(copy => copy.value).sort((a, b) => (b.value.storageRevision || 0) - (a.value.storageRevision || 0));
    if (!valid.length) {
      if (copies.every(copy => copy.missing)) return null;
      throw new Error('Airport save and recovery copy could not be verified. Keep these files and restore a valid backup; progress has not been reset.');
    }
    const chosen = valid[0];
    if (!copies[0].value || chosen.file !== this.file) {
      await this.atomicWrite(this.file, chosen.raw);
      this.recovered = true;
    }
    return chosen.value;
  }

  async atomicWrite(file, value) {
    const temp = `${file}.${process.pid}.tmp`;
    const handle = await fs.open(temp, 'w', 0o600);
    try { await handle.writeFile(value, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, file);
  }

  async write(value) {
    const encoded = this.encode(value);
    // Both copies represent the most recently acknowledged durable transaction.
    // If the primary write is interrupted, startup can recover the committed backup.
    await this.atomicWrite(this.backup, encoded);
    await this.atomicWrite(this.file, encoded).catch(() => { this.recovered = true; });
  }

  async close() {
    if (!this.lock) return;
    await this.lock.close();
    this.lock = null;
    await fs.unlink(this.lockPath).catch(() => {});
    this.key?.fill(0);
  }
}
