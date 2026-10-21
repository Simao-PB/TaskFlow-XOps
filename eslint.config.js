const security = require('eslint-plugin-security');

module.exports = [
  {
    ignores: ['node_modules/**']
  },
  security.configs.recommended
];