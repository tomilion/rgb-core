module.exports = {
    root: true,
    parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
    },
    extends: ['lisk-base/ts'],
    rules: {
        semi: [2, "always"]
    },
};
