// Global test setup
beforeEach(() => {
  // Clear any pending timers
  jest.clearAllTimers();
});

afterEach(async () => {
  // Wait for any pending promises to resolve
  await new Promise(resolve => setTimeout(resolve, 50));
});

afterAll(async () => {
  // Cleanup after all tests
  await new Promise(resolve => setTimeout(resolve, 100));
});
