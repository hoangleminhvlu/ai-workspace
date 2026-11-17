import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      // eslint-plugin-react-hooks 5.x cung cấp flat config qua 'recommended-latest' (configs.flat chỉ có từ bản 6)
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Biến dùng trong JSX (<App />, <Route />...) và hằng số viết hoa không bị báo là "không dùng";
      // ignoreRestSiblings: cho phép tách bỏ một thuộc tính khỏi props, vd. ({ node, ...props }) => <a {...props} />
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
    },
  },
  {
    // Tệp cấu hình chạy bằng Node.js (vite, tailwind, postcss, eslint)
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
