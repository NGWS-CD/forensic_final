const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'web-forrensic.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'WebForensic',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react'
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: 'production',
  devtool: 'source-map'
}; 
