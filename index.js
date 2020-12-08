const vm = require('vm');
const os = require('os');
const loaderUtils = require('loader-utils');
const { print, parse, separateOperations } = require('graphql');
const { addTypenameToDocument } = require('apollo-utilities');

module.exports = function graphQLPersistedDocumentLoader(content) {
  const deps = [];
  const context = this;
  const options = loaderUtils.getOptions(this) || {};

  // Create a fake sandbox to intercept the query dependencies when
  // executing the generated code from the graphql-tag loader.
  const sandbox = {
    require(file) {
      deps.push(new Promise((resolve, reject) => {
        context.loadModule(file, (err, source, sourceMap, module) => {
          if (err) {
            reject(err);
          } else {
            resolve({ source, sourceMap, module });
          }
        });
      }));
      return { definitions: [] };
    },
    module: {
      exports: null
    }
  };
  // Run the graphql-tag loader generated code to capture the dependencies.
  vm.runInNewContext(content, sandbox);

  // Get the query document source from the exported module, and
  // save it so that we can use it from other modules that may depend on
  // this one.
  const doc = sandbox.module.exports;
  this._module._graphQLQuerySource = doc.loc.source.body;

  if (deps.length === 0) {
    // If no deps, just try to generate the document id from the
    // source returned from graphql-tag loader result. This will
    // add an id only if the source contains an operation.
    content = tryAddDocumentId(options, content, this._module._graphQLQuerySource);
    return content;
  }

  const callback = this.async();

  // If we have dependencies, we retrieve their query sources and
  // concatenate them with the one from this module, to create the
  // full query source.
  Promise.all(deps).then((modules) => {
    modules.forEach((mod, index) => {
      this._module._graphQLQuerySource += mod.module._graphQLQuerySource;
    });

    try {
      // Now that we have all our dependencies' sources concatenated
      // with this module's query source, we can send all that to
      // generate the document id, if the resulting source
      // is for an operation.
      content = tryAddDocumentId(options, content, this._module._graphQLQuerySource);
    } catch (e) {
      callback(e);
    }

    callback(null, content);
  }).catch((err) => {
    console.log('error', err);
    callback(err);
  });
};

function tryAddDocumentId(options, content, querySource) {
  // Every file may contain multiple operations
  const operations = separateOperations(parse(querySource));

  Object.keys(operations).map((operation) => {
    const document = options.addTypename
      ? addTypenameToDocument(operations[operation])
      : operations[operation];
    const query = print(document);

    const queryId = generateIdForQuery(options, query);

    // Add them as exports to the final file
    // If there is only one operation, it will be the default export
    if (Object.keys(operations).length > 1) {
      content += `${
        os.EOL
      }module.exports["${operation}"].documentId = ${JSON.stringify(queryId)};`;
    } else {
      content += `${os.EOL}doc.documentId = ${JSON.stringify(queryId)}`;
    }
  });

  return content;
}

function generateIdForQuery(options, query) {
  if (options.generateId) return options.generateId(query);

  return require('crypto').createHash('sha256').update(query).digest('hex');
}
