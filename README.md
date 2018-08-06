# GraphQL Persisted Document Loader

Webpack loader that assigns a documentId to a compiled GraphQL document's AST.

## Why

When dealing with persisted documents in GraphQL, tools like [PersistGraphQL](https://github.com/apollographql/persistgraphql) generate a map from query to id that helps you determine the id for a given document and send that to the server instead of the full query string. This is useful to optimize the payload sent to the server, and also to allow the server to not parse and validate those queries, and also to optimize them particularly since the server now knows which queries the client will send.

However, on the client we still need to load up this map of queries to ids, which may become too big to load in one shot if your app has quite some queries. Moreover, if you are using code splitting, you'll be loading a file that includes queries for sections of your app that may never be executed or loaded.

To solve this problem, this loader works after the [graphql-tag loader](https://github.com/apollographql/graphql-tag) by injecting the document id as a property to the compiled AST, so you can access it directly when importing/requiring the document. This effectively co-locates the id with the query, and you no longer need a big lookup map to get the id for a particular query document.

## Installation and setup

You need to have the [graphql-tag](https://github.com/apollographql/graphql-tag) *(>= v2.8.0)* package installed.

First install this package

```
npm install --save-dev graphql-persisted-document-loader
```

Then in the webpack configuration, add the loader **BEFORE** the `graphql-tag/loader`:

> Note: This loader currently only works for .graphql files. It does not work for `gql` calls within JS files.

```js
module.exports = {
  // ...,
  module: {
    rules: [
      {
        test: /\.graphql$/, use: [
          { loader: 'graphql-persisted-document-loader' }, // <= Before graphql-tag/loader!
          { loader: 'graphql-tag/loader' }
        ]
      }
    ]
  }
};
```

## Usage

When importing or requiring `.graphql` files, you'll have the `documentId` property accessible from the imported object:

```js
import query from 'query.graphql';
// OR
const query = require('query.graphql');

console.log(query.documentId); // => 5eef6cd6a52ee0d67bfbb0fdc72bbbde4d70331834eeec95787fe71b45f0a491
```

## Loader options

* `generateId`: `function (querySource: string) => string` Function that allows to generate a custom documentId from the query source. This source contains all the dependencies sources concatenated, so it's suitable for hashing. By default it generates the sha256 hash in hexadecimal format. The source is concatenated in the same way as you'd get it from the `persistgraphql` tool, so hashing the queries from the output of that tool should get you the same hash value.
* `addTypename`: `boolean` Apply a query transformation to the query documents, adding the __typename field at every level of the query. You must pass this option if your client code uses this query transformation.


