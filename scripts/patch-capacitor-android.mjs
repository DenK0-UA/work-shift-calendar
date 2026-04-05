import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const makeJob = (relativePath, replacements) => ({
  relativePath,
  absolutePath: path.join(rootDir, ...relativePath.split('/')),
  replacements,
});

const capacitorPluginBuildReplacements = (namespaceValue) => [
  {
    oldValue: 'url "https://plugins.gradle.org/m2/"',
    newValue: 'url = "https://plugins.gradle.org/m2/"',
  },
  {
    oldValue: `namespace "${namespaceValue}"`,
    newValue: `namespace = "${namespaceValue}"`,
  },
  {
    oldValue: 'abortOnError false',
    newValue: 'abortOnError = false',
  },
  {
    oldValue: "getDefaultProguardFile('proguard-android.txt')",
    newValue: "getDefaultProguardFile('proguard-android-optimize.txt')",
  },
];

const patchJobs = [
  makeJob('node_modules/@capacitor/android/capacitor/build.gradle', [
    {
      oldValue: 'url "https://plugins.gradle.org/m2/"',
      newValue: 'url = "https://plugins.gradle.org/m2/"',
    },
    {
      oldValue: 'namespace "com.getcapacitor.android"',
      newValue: 'namespace = "com.getcapacitor.android"',
    },
    {
      oldValue: 'abortOnError true',
      newValue: 'abortOnError = true',
    },
    {
      oldValue: 'warningsAsErrors true',
      newValue: 'warningsAsErrors = true',
    },
    {
      oldValue: "lintConfig file('lint.xml')",
      newValue: "lintConfig = file('lint.xml')",
    },
    {
      oldValue: "getDefaultProguardFile('proguard-android.txt')",
      newValue: "getDefaultProguardFile('proguard-android-optimize.txt')",
    },
  ]),
  makeJob(
    'node_modules/@capacitor/app/android/build.gradle',
    capacitorPluginBuildReplacements('com.capacitorjs.plugins.app'),
  ),
  makeJob(
    'node_modules/@capacitor/app-launcher/android/build.gradle',
    capacitorPluginBuildReplacements('com.capacitorjs.plugins.applauncher'),
  ),
  makeJob(
    'node_modules/@capacitor/browser/android/build.gradle',
    capacitorPluginBuildReplacements('com.capacitorjs.plugins.browser'),
  ),
  makeJob('android/capacitor-cordova-android-plugins/build.gradle', [
    {
      oldValue: 'namespace "capacitor.cordova.android.plugins"',
      newValue: 'namespace = "capacitor.cordova.android.plugins"',
    },
    {
      oldValue: 'abortOnError false',
      newValue: 'abortOnError = false',
    },
  ]),
];

let patchedFilesCount = 0;

for (const job of patchJobs) {
  try {
    const source = await readFile(job.absolutePath, 'utf8');
    let nextSource = source;

    for (const replacement of job.replacements) {
      if (nextSource.includes(replacement.oldValue)) {
        nextSource = nextSource.replaceAll(replacement.oldValue, replacement.newValue);
      }
    }

    if (nextSource === source) {
      console.log(`No patch needed: ${job.relativePath}`);
      continue;
    }

    await writeFile(job.absolutePath, nextSource, 'utf8');
    patchedFilesCount += 1;
    console.log(`Patched: ${job.relativePath}`);
  } catch (error) {
    console.warn(`Skipping ${job.relativePath}: ${error.message}`);
  }
}

if (patchedFilesCount === 0) {
  console.log('Android Gradle patches already applied or not needed.');
} else {
  console.log(`Patched ${patchedFilesCount} Android Gradle file(s).`);
}
