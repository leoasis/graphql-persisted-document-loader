const path = require('path');

module.exports = {
  context: __dirname,
  entry: './app.js',
  output: {
    filename: 'bundle.js'
  },
  devServer: {
    contentBase: path.join(__dirname)
  },
  stats: 'detailed',
  module: {
    rules: [
      {
        test: /\.graphql$/, use: [
          {
            loader: '../index',
            options: {
              addTypename: true,
              // generateId(querySource) {
              //   return require('crypto').createHash('md5').update(querySource).digest('base64').substring(0, 8);
              // }
            }
          },
          { loader: 'graphql-tag/loader' }
        ]
      }
    ]
  }
};
