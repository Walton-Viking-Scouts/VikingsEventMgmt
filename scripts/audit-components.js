#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MAX_LINES = 500;
const SRC_DIR = path.join(__dirname, '../src');

// Patterns to identify React components
const COMPONENT_PATTERNS = [
  /^export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/m,
  /^const\s+([A-Z][a-zA-Z0-9]*)\s*=.*=>\s*{/m,
  /^function\s+([A-Z][a-zA-Z0-9]*)/m,
  /^export\s+function\s+([A-Z][a-zA-Z0-9]*)/m,
];

// Patterns that might indicate multiple responsibilities
const RESPONSIBILITY_INDICATORS = [
  { pattern: /useEffect/g, name: 'useEffect hooks' },
  { pattern: /useState/g, name: 'useState hooks' },
  { pattern: /fetch|axios|api\./g, name: 'API calls' },
  { pattern: /localStorage|sessionStorage/g, name: 'storage operations' },
  { pattern: /console\.(log|error|warn)/g, name: 'console operations' },
  { pattern: /setTimeout|setInterval/g, name: 'timer operations' },
  { pattern: /addEventListener|removeEventListener/g, name: 'DOM event listeners' },
  { pattern: /import.*from.*\/services\//g, name: 'service imports' },
  { pattern: /import.*from.*\/hooks\//g, name: 'custom hook imports' },
  { pattern: /className.*=.*\{/g, name: 'conditional styling' },
];

/**
 * Get all JS/JSX files in the src directory
 */
function getAllSourceFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir);
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && (entry.endsWith('.jsx') || entry.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Analyze a file for component information
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  
  // Check if file contains React components
  const componentNames = [];
  for (const pattern of COMPONENT_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      componentNames.push(match[1]);
    }
  }
  
  // Skip non-component files (services, utils, config, etc.)
  if (componentNames.length === 0) {
    return null;
  }
  
  // Count responsibility indicators
  const responsibilities = {};
  let totalIndicators = 0;
  
  for (const { pattern, name } of RESPONSIBILITY_INDICATORS) {
    const matches = content.match(pattern);
    if (matches) {
      responsibilities[name] = matches.length;
      totalIndicators += matches.length;
    }
  }
  
  // Calculate complexity score based on responsibilities
  const complexityScore = Math.min(totalIndicators, 10);
  
  // Determine if component has mixed responsibilities
  const responsibilityCount = Object.keys(responsibilities).length;
  const hasMixedResponsibilities = responsibilityCount > 5 || 
    (responsibilities['API calls'] && responsibilities['DOM event listeners']) ||
    (responsibilities['storage operations'] && responsibilities['timer operations']);
  
  return {
    filePath: path.relative(SRC_DIR, filePath),
    componentNames,
    lineCount,
    exceeds500Lines: lineCount > MAX_LINES,
    complexityScore,
    responsibilities,
    responsibilityCount,
    hasMixedResponsibilities,
    issues: [],
  };
}

/**
 * Generate audit report
 */
function generateAuditReport(analyses) {
  const validAnalyses = analyses.filter(a => a !== null);
  
  const oversizedComponents = validAnalyses.filter(a => a.exceeds500Lines);
  const mixedResponsibilityComponents = validAnalyses.filter(a => a.hasMixedResponsibilities);
  const highComplexityComponents = validAnalyses.filter(a => a.complexityScore >= 7);
  
  console.log('='.repeat(80));
  console.log('COMPONENT SIZE AND RESPONSIBILITY AUDIT REPORT');
  console.log('='.repeat(80));
  console.log();
  
  console.log('📊 SUMMARY:');
  console.log(`  Total components analyzed: ${validAnalyses.length}`);
  console.log(`  Components exceeding 500 lines: ${oversizedComponents.length}`);
  console.log(`  Components with mixed responsibilities: ${mixedResponsibilityComponents.length}`);
  console.log(`  High complexity components (score ≥7): ${highComplexityComponents.length}`);
  console.log();
  
  // Report oversized components
  if (oversizedComponents.length > 0) {
    console.log('🚨 OVERSIZED COMPONENTS (>500 lines):');
    console.log('-'.repeat(50));
    oversizedComponents
      .sort((a, b) => b.lineCount - a.lineCount)
      .forEach(component => {
        console.log(`  📄 ${component.filePath}`);
        console.log(`     Lines: ${component.lineCount} (${component.lineCount - MAX_LINES} over limit)`);
        console.log(`     Components: ${component.componentNames.join(', ')}`);
        console.log(`     Complexity Score: ${component.complexityScore}/10`);
        console.log();
      });
  }
  
  // Report mixed responsibility components
  if (mixedResponsibilityComponents.length > 0) {
    console.log('⚠️  MIXED RESPONSIBILITY COMPONENTS:');
    console.log('-'.repeat(50));
    mixedResponsibilityComponents
      .sort((a, b) => b.responsibilityCount - a.responsibilityCount)
      .forEach(component => {
        console.log(`  📄 ${component.filePath}`);
        console.log(`     Components: ${component.componentNames.join(', ')}`);
        console.log(`     Lines: ${component.lineCount}`);
        console.log(`     Responsibility areas: ${component.responsibilityCount}`);
        console.log(`     Complexity Score: ${component.complexityScore}/10`);
        console.log('     Responsibilities:');
        Object.entries(component.responsibilities).forEach(([name, count]) => {
          console.log(`       - ${name}: ${count}`);
        });
        console.log();
      });
  }
  
  // Report high complexity components
  if (highComplexityComponents.length > 0) {
    console.log('🔥 HIGH COMPLEXITY COMPONENTS (score ≥7):');
    console.log('-'.repeat(50));
    highComplexityComponents
      .sort((a, b) => b.complexityScore - a.complexityScore)
      .forEach(component => {
        console.log(`  📄 ${component.filePath}`);
        console.log(`     Components: ${component.componentNames.join(', ')}`);
        console.log(`     Lines: ${component.lineCount}`);
        console.log(`     Complexity Score: ${component.complexityScore}/10`);
        console.log();
      });
  }
  
  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  console.log('-'.repeat(50));
  
  if (oversizedComponents.length > 0) {
    console.log('  1. Split oversized components into smaller, focused units');
    console.log('     - Extract reusable UI components');
    console.log('     - Move business logic to custom hooks');
    console.log('     - Use compound component patterns where appropriate');
    console.log();
  }
  
  if (mixedResponsibilityComponents.length > 0) {
    console.log('  2. Refactor mixed-responsibility components:');
    console.log('     - Extract API logic to services or custom hooks');
    console.log('     - Move storage operations to context or custom hooks');
    console.log('     - Separate UI rendering from business logic');
    console.log();
  }
  
  if (highComplexityComponents.length > 0) {
    console.log('  3. Reduce complexity in high-complexity components:');
    console.log('     - Apply single responsibility principle');
    console.log('     - Extract helper functions and custom hooks');
    console.log('     - Consider code splitting and lazy loading');
    console.log();
  }
  
  console.log('  4. Implement automated checks:');
  console.log('     - Add ESLint rules for component size limits');
  console.log('     - Set up pre-commit hooks for size validation');
  console.log('     - Consider component complexity metrics in CI/CD');
  console.log();
  
  return {
    totalComponents: validAnalyses.length,
    oversizedComponents: oversizedComponents.length,
    mixedResponsibilityComponents: mixedResponsibilityComponents.length,
    highComplexityComponents: highComplexityComponents.length,
    issues: [
      ...oversizedComponents.map(c => ({
        type: 'oversized',
        file: c.filePath,
        lines: c.lineCount,
        components: c.componentNames,
      })),
      ...mixedResponsibilityComponents.map(c => ({
        type: 'mixed-responsibility',
        file: c.filePath,
        lines: c.lineCount,
        components: c.componentNames,
        responsibilities: c.responsibilityCount,
      })),
    ],
  };
}

/**
 * Main audit function
 */
function auditComponents() {
  console.log('Starting component size and responsibility audit...\n');
  
  const sourceFiles = getAllSourceFiles(SRC_DIR);
  console.log(`Found ${sourceFiles.length} source files to analyze...\n`);
  
  const analyses = sourceFiles.map(analyzeFile);
  const report = generateAuditReport(analyses);
  
  // Save detailed report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalComponents: report.totalComponents,
      oversizedComponents: report.oversizedComponents,
      mixedResponsibilityComponents: report.mixedResponsibilityComponents,
      highComplexityComponents: report.highComplexityComponents,
    },
    issues: report.issues,
    analyses: analyses.filter(a => a !== null),
  };
  
  const reportPath = path.join(__dirname, '../docs/development/component-audit-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  
  console.log(`📋 Detailed report saved to: ${path.relative(process.cwd(), reportPath)}`);
  console.log();
  
  return report;
}

// Run audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  auditComponents();
}

export default auditComponents;