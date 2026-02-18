const { Config } = require('@remotion/cli/config');

// Workaround: @remotion/bundler's webpack config aliases '@remotion/studio' to its
// main file (dist/index.js). This breaks subpath imports like '@remotion/studio/renderEntry'
// because webpack appends '/renderEntry' to the aliased file path instead of using
// the package's exports field.
//
// Fix: replace the prefix alias with an exact-match alias (the '$' suffix in webpack
// means "exact match only") so that '@remotion/studio/renderEntry' falls through to
// webpack's normal exports-field resolution, which correctly resolves it to dist/renderEntry.js.
Config.overrideWebpackConfig((current) => {
  const aliasSource = current.resolve?.alias || {};
  const { '@remotion/studio': studioAlias, ...restAliases } = aliasSource;

  const alias = {
    ...restAliases,
    // Explicit subpath alias so webpack uses the right file
    '@remotion/studio/renderEntry': require.resolve('@remotion/studio/renderEntry'),
  };
  if (studioAlias !== undefined) {
    // Exact match only: '@remotion/studio' (not '@remotion/studio/renderEntry')
    alias['@remotion/studio$'] = studioAlias;
  }

  return {
    ...current,
    resolve: {
      ...current.resolve,
      alias,
    },
  };
});
