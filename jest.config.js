module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: [],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(jpg|jpeg|png|gif|svg|ico|webp)$': '<rootDir>/src/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx|mjs|cjs)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-markdown|remark-parse|remark-rehype|rehype-stringify|rehype-raw|unified|bail|is-plain-obj|trough|vfile|vfile-message|unist-util-stringify-position|unist-util-visit|unist-util-is|unist-util-visit-parents|mdast-util-from-markdown|mdast-util-to-markdown|mdast-util-to-hast|mdast-util-definitions|mdast-util-phrasing-content|mdast-util-gfm|mdast-util-frontmatter|micromark|micromark-core-commonmark|micromark-extension-gfm|micromark-util-character|micromark-util-chunked|micromark-util-classify-character|micromark-util-combine-extensions|micromark-util-decode-numeric-character-reference|micromark-util-decode-string|micromark-util-encode|micromark-util-html-tag-name|micromark-util-normalize-identifier|micromark-util-resolve-all|micromark-util-sanitize-uri|micromark-util-subtokenize|micromark-util-types|decode-named-character-reference|character-entities|property-information|hast-util-to-jsx-runtime|hast-util-whitespace|hast-util-is-element|hast-util-raw|hast-util-from-parse5|hast-util-to-parse5|space-separated-tokens|comma-separated-tokens|html-void-elements|ccount|escape-string-regexp|zwitch|longest-streak|trim-lines|web-namespaces|extend|parse5|entities|remark-gfm|rehype-sanitize))',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
};
