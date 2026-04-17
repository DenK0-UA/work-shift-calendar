import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'android/**',
            'node_modules/**',
            'www/**'
        ]
    },
    {
        files: ['js/**/*.js', 'data/**/*.js', 'sw.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'script',
            globals: {
                ...globals.browser
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            // Classic global scripts share symbols across files by design.
            'no-undef': 'off',
            // This codebase stores many intentionally unused args for safety guards.
            'no-unused-vars': 'off',
            // Some guarded try/catch blocks intentionally swallow fallback errors.
            'no-empty': 'off'
        }
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            ...js.configs.recommended.rules
        }
    }
];
