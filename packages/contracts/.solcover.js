module.exports = {
  skipFiles: ['mocks/', 'test/'],
  istanbulReporter: ['html', 'lcov', 'text', 'json-summary'],
  mocha: {
    timeout: 60000,
  },
  // Coverage thresholds - critical contracts need 95%+
  // Run with: pnpm coverage:check
  configureYulOptimizer: true,
};
