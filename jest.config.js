module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    transformIgnorePatterns: ['/node_modules/(?!eventemitter3)'],
    moduleNameMapper: {
        '^tronweb/dist/TronWeb\\.js$': '<rootDir>/tests/__mocks__/TronWeb.js',
        '^../package\\.json$': '<rootDir>/package.json',
    },
};
