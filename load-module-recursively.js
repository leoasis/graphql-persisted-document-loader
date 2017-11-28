/* eslint-disable */
// This code is copied from Webpack's code and modified so that it can load modules
// recursively, otherwise the loader for persisted queries fails if there are
// queries that depend on other files.

// There's an issue in Webpack that talks about this problem
// https://github.com/webpack/webpack/issues/4959
// Once it's solved, we won't need this file.
// The file copied from is https://github.com/webpack/webpack/blob/master/lib/dependencies/LoaderPlugin.js
const LoaderDependency = require('webpack/lib/dependencies/LoaderDependency');

module.exports = function loadModuleRecursively(loaderContext, request, callback) {
  const {
    _compilation: compilation,
    _module: module
  } = loaderContext;
  const dep = new LoaderDependency(request);
  dep.loc = request;
  compilation.addModuleDependencies(module, [
    [dep]
  ], true, "lm", true /* This is _false_ in the original file */, (err) => {
    if(err) return callback(err);

    if(!dep.module) return callback(new Error("Cannot load the module"));
    if(dep.module.building) dep.module.building.push(next);
    else next();

    function next(err) {
      if(err) return callback(err);

      if(dep.module.error) return callback(dep.module.error);
      if(!dep.module._source) throw new Error("The module created for a LoaderDependency must have a property _source");
      let source, map;
      const moduleSource = dep.module._source;
      if(moduleSource.sourceAndMap) {
        const sourceAndMap = moduleSource.sourceAndMap();
        map = sourceAndMap.map;
        source = sourceAndMap.source;
      } else {
        map = moduleSource.map();
        source = moduleSource.source();
      }
      if(dep.module.fileDependencies) {
        dep.module.fileDependencies.forEach((dep) => loaderContext.addDependency(dep));
      }
      if(dep.module.contextDependencies) {
        dep.module.contextDependencies.forEach((dep) => loaderContext.addContextDependency(dep));
      }
      return callback(null, source, map, dep.module);
    }
  });
};
/* eslint-enable */
