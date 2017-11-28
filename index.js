const vm = require('vm');
const os = require('os');
const loaderUtils = require('loader-utils');
const { ExtractGQL } = require('persistgraphql/lib/src/ExtractGQL');
const queryTransformers = require('persistgraphql/lib/src/queryTransformers');
const loadModuleRecursively = require('./load-module-recursively');

module.exports = function graphQLpersistedDocumentLoader(content) {
  const deps = [];
  const context = this;
  const options = loaderUtils.getOptions(this) || {};

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
  vm.runInNewContext(content, sandbox);

  const doc = sandbox.module.exports;
  this._module._graphQLQuerySource = doc.loc.source.body;

  if (deps.length === 0) {
    content = tryAddDocumentId(options, content, this._module._graphQLQuerySource);
    return content;
  }

  const callback = this.async();

  Promise.all(deps).then((modules) => {
    modules.forEach((mod, index) => {
      this._module._graphQLQuerySource += mod.module._graphQLQuerySource;
    });

    try {
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
  const queryMap = new ExtractGQL({
    queryTransformers: [options.addTypename && queryTransformers.addTypenameTransformer].filter(Boolean)
  }).createOutputMapFromString(querySource);

  const queries = Object.keys(queryMap);
  if (queries.length > 1) {
    throw new Error('Only one operation per file is allowed');
  } else if (queries.length === 1) {
    const queryId = generateIdForQuery(options, Object.keys(queryMap)[0]);
    content += `${os.EOL}doc.documentId = ${JSON.stringify(queryId)}`;
  }

  return content;
}

function generateIdForQuery(options, query) {
  if (options.generateId) return options.generateId(query);

  return require('crypto').createHash('sha256').update(query).digest('hex');
}
