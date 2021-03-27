module.exports = {
  extends: './node_modules/kcd-scripts/eslint.js',
  rules: {
    'consistent-return': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-base-to-string': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/sort-type-union-intersection-members': 'off',
    '@typescript-eslint/non-nullable-type-assertion-style': 'off',
  },
}
