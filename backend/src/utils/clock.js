/**
 * Centralized Clock Utility
 * Allows tests to mock time deterministically without monkey-patching global Date.
 */
let mockTimestamp = null;

export const clock = {
  /**
   * Returns current Date or mocked Date
   * @returns {Date}
   */
  now() {
    if (mockTimestamp !== null) {
      return new Date(mockTimestamp);
    }
    return new Date();
  },

  /**
   * Set mock time for testing
   * @param {Date|string|number} time
   */
  setMockTime(time) {
    mockTimestamp = new Date(time).getTime();
  },

  /**
   * Reset to real system clock
   */
  reset() {
    mockTimestamp = null;
  },
};

export default clock;
