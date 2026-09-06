module.exports = {
  projects: [
    {
      displayName: 'engine',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      transform: {'^.+\\.tsx?$': ['ts-jest', {tsconfig: {target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true}}]},
      clearMocks: true,
    },
    {
      displayName: 'native-ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.screen.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/test/setup-native.ts'],
      clearMocks: true,
    },
  ],
};
