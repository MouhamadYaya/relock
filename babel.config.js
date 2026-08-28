module.exports = function (api) {
  const isTest = api.cache(() => process.env.NODE_ENV === 'test')

  return {
    presets: [
      isTest
        ? 'babel-preset-expo'
        : ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      ...(isTest ? [] : ['nativewind/babel']),
    ],
    plugins: [
      '@babel/plugin-transform-export-namespace-from',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@assets': './assets',
            '@types': './src/types',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
