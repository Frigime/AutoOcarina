import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('public/models/basic-pitch', { recursive: true });
cpSync('node_modules/@spotify/basic-pitch/model', 'public/models/basic-pitch', { recursive: true });

console.log('Models copied to public/');
