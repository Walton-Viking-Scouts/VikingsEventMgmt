#!/usr/bin/env node

/**
 * Performance benchmark script for Current Active Terms migration
 * Compares direct table lookup performance with legacy blob storage approach
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BenchmarkSuite {
  constructor() {
    this.results = {
      directTableLookup: [],
      legacyBlobSearch: [],
      batchOperations: [],
      indexedQueries: [],
    };
  }

  /**
   * Simulate direct table lookup (current implementation)
   */
  async benchmarkDirectTableLookup(iterations = 1000) {
    console.log(`\n📊 Benchmarking Direct Table Lookup (${iterations} iterations)...`);

    // Simulate indexed lookup with Map for best-case performance
    const mockTermsTable = new Map();

    // Populate with test data
    for (let i = 1; i <= 100; i++) {
      mockTermsTable.set(`section_${i}`, {
        sectionId: `section_${i}`,
        currentTermId: `term_${i}_2024`,
        termName: `2024 Term ${i}`,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        lastUpdated: Date.now(),
      });
    }

    const sectionIds = Array.from(mockTermsTable.keys());
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const randomSectionId = sectionIds[Math.floor(Math.random() * sectionIds.length)];

      const startTime = performance.now();
      const _term = mockTermsTable.get(randomSectionId);
      const endTime = performance.now();

      results.push(endTime - startTime);
    }

    this.results.directTableLookup = results;
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const median = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];

    console.log(`✅ Direct lookup - Avg: ${avg.toFixed(4)}ms, Min: ${min.toFixed(4)}ms, Max: ${max.toFixed(4)}ms, Median: ${median.toFixed(4)}ms`);

    return { avg, min, max, median, rawData: results };
  }

  /**
   * Simulate legacy blob storage search (previous implementation)
   */
  async benchmarkLegacyBlobSearch(iterations = 1000) {
    console.log(`\n📊 Benchmarking Legacy Blob Search (${iterations} iterations)...`);

    // Simulate blob storage with nested objects and arrays
    const mockTermsBlob = {};

    // Populate with test data - each section has multiple terms
    for (let i = 1; i <= 100; i++) {
      const sectionId = `section_${i}`;
      mockTermsBlob[sectionId] = [];

      // Add multiple terms per section (simulating historical data)
      for (let j = 2020; j <= 2024; j++) {
        mockTermsBlob[sectionId].push({
          termid: `term_${i}_${j}`,
          name: `${j} Term ${i}`,
          startdate: `${j}-01-01`,
          enddate: `${j}-12-31`,
        });
      }
    }

    const sectionIds = Object.keys(mockTermsBlob);
    const results = [];

    // Simulate the _determineCurrentTerm logic for each lookup
    const determineCurrentTerm = (sectionTerms) => {
      if (!Array.isArray(sectionTerms) || sectionTerms.length === 0) {
        return null;
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Find current terms
      const currentTerms = sectionTerms.filter(term => {
        const startDate = term.startdate || term.startDate;
        const endDate = term.enddate || term.endDate;
        return startDate <= today && today <= endDate;
      });

      if (currentTerms.length > 0) {
        return currentTerms[0];
      }

      // Find future terms
      const futureTerms = sectionTerms.filter(term => {
        const startDate = term.startdate || term.startDate;
        return startDate > today;
      }).sort((a, b) => {
        const aStart = a.startdate || a.startDate;
        const bStart = b.startdate || b.startDate;
        return aStart.localeCompare(bStart);
      });

      if (futureTerms.length > 0) {
        return futureTerms[0];
      }

      // Find most recent past term
      const pastTerms = sectionTerms.filter(term => {
        const endDate = term.enddate || term.endDate;
        return endDate < today;
      }).sort((a, b) => {
        const aEnd = a.enddate || a.endDate;
        const bEnd = b.enddate || b.endDate;
        return bEnd.localeCompare(aEnd);
      });

      return pastTerms.length > 0 ? pastTerms[0] : sectionTerms[0];
    };

    for (let i = 0; i < iterations; i++) {
      const randomSectionId = sectionIds[Math.floor(Math.random() * sectionIds.length)];

      const startTime = performance.now();

      // Simulate the full legacy lookup process
      const sectionTerms = mockTermsBlob[randomSectionId];
      const _currentTerm = determineCurrentTerm(sectionTerms);

      const endTime = performance.now();

      results.push(endTime - startTime);
    }

    this.results.legacyBlobSearch = results;
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const median = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];

    console.log(`✅ Legacy search - Avg: ${avg.toFixed(4)}ms, Min: ${min.toFixed(4)}ms, Max: ${max.toFixed(4)}ms, Median: ${median.toFixed(4)}ms`);

    return { avg, min, max, median, rawData: results };
  }

  /**
   * Benchmark batch operations
   */
  async benchmarkBatchOperations(batchSizes = [10, 50, 100]) {
    console.log('\n📊 Benchmarking Batch Operations...');

    const mockTermsTable = new Map();

    // Populate with test data
    for (let i = 1; i <= 100; i++) {
      mockTermsTable.set(`section_${i}`, {
        sectionId: `section_${i}`,
        currentTermId: `term_${i}_2024`,
        termName: `2024 Term ${i}`,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        lastUpdated: Date.now(),
      });
    }

    const results = {};

    for (const batchSize of batchSizes) {
      const batchResults = [];
      const sectionIds = Array.from(mockTermsTable.keys()).slice(0, batchSize);

      // Run multiple batch operations
      for (let iteration = 0; iteration < 100; iteration++) {
        const startTime = performance.now();

        const batchTerms = [];
        for (const sectionId of sectionIds) {
          const term = mockTermsTable.get(sectionId);
          if (term) batchTerms.push(term);
        }

        const endTime = performance.now();
        batchResults.push(endTime - startTime);
      }

      const avg = batchResults.reduce((a, b) => a + b, 0) / batchResults.length;
      results[`batch_${batchSize}`] = { avg, rawData: batchResults };

      console.log(`✅ Batch size ${batchSize} - Avg: ${avg.toFixed(4)}ms`);
    }

    this.results.batchOperations = results;
    return results;
  }

  /**
   * Benchmark indexed queries (lastUpdated, etc.)
   */
  async benchmarkIndexedQueries(iterations = 1000) {
    console.log(`\n📊 Benchmarking Indexed Queries (${iterations} iterations)...`);

    // Simulate indexed data structure
    const mockTermsTable = [];
    const lastUpdatedIndex = new Map(); // timestamp -> [records]

    // Populate with test data and build index
    for (let i = 1; i <= 100; i++) {
      const lastUpdated = Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000); // Random within last week
      const term = {
        sectionId: `section_${i}`,
        currentTermId: `term_${i}_2024`,
        termName: `2024 Term ${i}`,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        lastUpdated,
      };

      mockTermsTable.push(term);

      // Add to index
      if (!lastUpdatedIndex.has(lastUpdated)) {
        lastUpdatedIndex.set(lastUpdated, []);
      }
      lastUpdatedIndex.get(lastUpdated).push(term);
    }

    const results = [];
    const timestamps = Array.from(lastUpdatedIndex.keys()).sort((a, b) => a - b);

    for (let i = 0; i < iterations; i++) {
      // Random timestamp for range query
      const randomTimestamp = timestamps[Math.floor(Math.random() * timestamps.length * 0.8)]; // Earlier 80%

      const startTime = performance.now();

      // Simulate indexed range query
      const matchingTerms = [];
      for (const [timestamp, terms] of lastUpdatedIndex.entries()) {
        if (timestamp >= randomTimestamp) {
          matchingTerms.push(...terms);
        }
      }

      const endTime = performance.now();

      results.push(endTime - startTime);
    }

    this.results.indexedQueries = results;
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const median = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];

    console.log(`✅ Indexed queries - Avg: ${avg.toFixed(4)}ms, Min: ${min.toFixed(4)}ms, Max: ${max.toFixed(4)}ms, Median: ${median.toFixed(4)}ms`);

    return { avg, min, max, median, rawData: results };
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const directStats = this.calculateStats(this.results.directTableLookup);
    const legacyStats = this.calculateStats(this.results.legacyBlobSearch);
    const indexedStats = this.calculateStats(this.results.indexedQueries);

    const performanceImprovement = {
      averageSpeedup: legacyStats.avg / directStats.avg,
      medianSpeedup: legacyStats.median / directStats.median,
      consistencyImprovement: legacyStats.stdDev / directStats.stdDev,
    };

    return {
      summary: {
        directTableLookup: directStats,
        legacyBlobSearch: legacyStats,
        indexedQueries: indexedStats,
        performanceImprovement,
        batchOperations: this.results.batchOperations,
      },
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }

  calculateStats(data) {
    if (!data || data.length === 0) return null;

    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const sorted = [...data].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    // Standard deviation
    const variance = data.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return { avg, min, max, median, p95, p99, stdDev, count: data.length };
  }

  /**
   * Run all benchmarks and generate report
   */
  async runAllBenchmarks() {
    console.log('🚀 Starting Current Active Terms Performance Benchmark Suite');
    console.log('================================================================');

    try {
      await this.benchmarkDirectTableLookup(1000);
      await this.benchmarkLegacyBlobSearch(1000);
      await this.benchmarkIndexedQueries(1000);
      await this.benchmarkBatchOperations([10, 50, 100]);

      console.log('\n📈 Generating Performance Report...');
      const report = this.generateReport();

      // Save report to file
      const reportPath = path.join(__dirname, '..', 'docs', 'development', 'performance-benchmarks.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      console.log('\n🎉 Benchmark Complete!');
      console.log('================================================================');
      console.log('📊 Performance Improvements:');
      console.log(`   • Average Speed: ${report.summary.performanceImprovement.averageSpeedup.toFixed(2)}x faster`);
      console.log(`   • Median Speed: ${report.summary.performanceImprovement.medianSpeedup.toFixed(2)}x faster`);
      console.log(`   • Consistency: ${report.summary.performanceImprovement.consistencyImprovement.toFixed(2)}x more consistent`);
      console.log(`📄 Full report saved to: ${reportPath}`);

      return report;
    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      throw error;
    }
  }
}

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new BenchmarkSuite();
  suite.runAllBenchmarks().catch(console.error);
}

export { BenchmarkSuite };