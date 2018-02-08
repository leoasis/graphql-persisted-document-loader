const vm = require('vm');
const os = require('os');
const loaderUtils = require('loader-utils');
const { ExtractGQL } = require('persistgraphql/lib/src/ExtractGQL');
const queryTransformers = require('persistgraphql/lib/src/queryTransformers');
const loadModuleRecursively = require('./load-module-recursively');

module.exports = function graphQLPersistedDocumentLoader(content) {
  const deps = [];
  const context = this;
  const options = loaderUtils.getOptions(this) || {};

  // Create a fake sandbox to intercept the query dependencies when
  // executing the generated code from the graphql-tag loader.
  const sandbox = {
    require(file) {
      deps.push(new Promise((resolve, reject) => {
        loadModuleRecursively(context, file, (err, source, sourceMap, module) => {
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
    content = tryAddDocumentId(options, content, this._module);
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
      content = tryAddDocumentId(options, content, this._module);
    } catch (e) {
      callback(e);
    }

    callback(null, content);
  }).catch((err) => {
    console.log('error', err);
    callback(err);
  });
};

function tryAddDocumentId(options, content, module) {
  const querySource = module._graphQLQuerySource
  const queryMap = new ExtractGQL({
    queryTransformers: [options.addTypename && queryTransformers.addTypenameTransformer].filter(Boolean)
  }).createOutputMapFromString(querySource);

  const queries = Object.keys(queryMap);
  if (queries.length > 1) {
    throw new Error('Only one operation per file is allowed');
  } else if (queries.length === 1) {
    const queryId = generateIdForQuery(options, Object.keys(queryMap)[0]);
    content += `${os.EOL}doc.documentId = ${JSON.stringify(queryId)}`;

    // Make the generated queryId visible for other modules 
    module._graphQLQueryId = queryId
  }

  return content;
}

function generateIdForQuery(options, query) {
  if (options.generateId) return options.generateId(query);

  return require('crypto').createHash('sha256').update(query).digest('hex');
}
