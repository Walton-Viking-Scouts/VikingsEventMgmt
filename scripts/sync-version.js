#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');

function getVersionFromGit() {
  // Use sorted tags instead of git describe to get the ACTUAL latest tag,
  // not just the latest reachable from current commit
  try {
    const allTags = execSync('git tag -l "v*.*.*" | sort -V | tail -1', {
      encoding: 'utf8',
      stdio: 'pipe',
      shell: '/bin/bash',
    }).trim();

    if (allTags && allTags.match(/^v?\d+\.\d+\.\d+/)) {
      const version = allTags.replace(/^v/, '');
      console.log(`✅ Found latest git tag: ${allTags} → Using version: ${version}`);
      return version;
    }
  } catch (error) {
    console.warn('⚠️  Could not get version from sorted tags:', error.message);
  }

  // Fallback: Try git tag --sort (requires Git 2.0+)
  try {
    const allTags = execSync('git tag --sort=-version:refname', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    const tags = allTags.split(/\r?\n/).filter(Boolean);
    const latestTag = tags.find(tag => tag.match(/^v?\d+\.\d+\.\d+/));

    if (latestTag) {
      const version = latestTag.replace(/^v/, '');
      console.log(`✅ Found sorted git tag (fallback): ${latestTag} → Using version: ${version}`);
      return version;
    }
  } catch (error) {
    console.warn('⚠️  Could not get sorted tags (fallback):', error.message);
  }

  return null;
}

function updatePackageJsonVersion() {
  const gitVersion = getVersionFromGit();

  if (!gitVersion) {
    console.log('ℹ️  No git tag found, keeping package.json version as-is');
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;

  if (currentVersion === gitVersion) {
    console.log(`ℹ️  package.json version (${currentVersion}) already matches git tag`);
    return;
  }

  console.log(`📝 Updating package.json version: ${currentVersion} → ${gitVersion}`);
  packageJson.version = gitVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✅ package.json version updated successfully');
}

if (process.env.CI || process.env.NODE_ENV === 'production') {
  console.log('🔄 Syncing version from git tags...');
  updatePackageJsonVersion();
} else {
  console.log('ℹ️  Development mode - skipping version sync');
}
