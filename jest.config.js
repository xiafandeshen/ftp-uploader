module.exports = {
  testEnvironment: "node",
  verbose: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coveragePathIgnorePatterns: ["/node_modules/", "/tests/fixtures/"],
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./tests/setup.js"],
}
