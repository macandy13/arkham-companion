/**
 * Enforces the CSS conventions in docs/coding-guidelines.md § 5: raw values live only in
 * tokens.css, everything else references them via var(--…).
 * @type {import('stylelint').Config}
 */
export default {
  extends: ['stylelint-config-standard'],
  // Predates the token system; migrated to tokens.css in the next change, then removed here.
  ignoreFiles: ['apps/web/src/app.css'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    // Plain string imports are what Vite resolves and what our files use.
    'import-notation': 'string',
    'color-named': 'never',
    'color-no-hex': true,
    // Colour functions would bypass color-no-hex; colours belong in tokens.css.
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'color',
    ],
    'declaration-no-important': true,
    'max-nesting-depth': 2,
    'selector-max-compound-selectors': 3,
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background',
        'fill',
        'stroke',
        '/^(margin|padding)/',
        '/gap$/',
        'font-family',
        'font-size',
        'border',
        '/^border-(top|right|bottom|left)$/',
        'border-radius',
        'box-shadow',
      ],
      {
        // Keywords and zero are not design decisions, so they need no token.
        ignoreValues: [
          '0',
          'auto',
          'none',
          'inherit',
          'initial',
          'unset',
          'transparent',
          'currentcolor',
        ],
      },
    ],
  },
  overrides: [
    {
      // The one place where raw values are defined.
      files: ['apps/web/src/styles/tokens.css'],
      rules: {
        'color-no-hex': null,
        'function-disallowed-list': null,
        'scale-unlimited/declaration-strict-value': null,
      },
    },
  ],
};
