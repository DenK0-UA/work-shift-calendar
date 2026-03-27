import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const capacitorGradlePath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'build.gradle',
);

const oldValue = "getDefaultProguardFile('proguard-android.txt')";
const newValue = "getDefaultProguardFile('proguard-android-optimize.txt')";

try {
  const source = await readFile(capacitorGradlePath, 'utf8');

  if (!source.includes(oldValue)) {
    console.log('Capacitor Android patch already applied or not needed.');
    process.exit(0);
  }

  const nextSource = source.replace(oldValue, newValue);
  await writeFile(capacitorGradlePath, nextSource, 'utf8');
  console.log('Patched Capacitor Android Gradle config for modern AGP.');
} catch (error) {
  console.warn(`Skipping Capacitor Android patch: ${error.message}`);
}
