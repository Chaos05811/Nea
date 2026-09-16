// Only device safe-area measurements are substituted. Screen navigation,
// components, press handlers, and message state are the real app code.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default || mock;
});
