// How to run:
// jscodeshift -t glamor-jss/codeshift.js src
export default (file, api) => {
  const root = api.jscodeshift(file.source);
  for (const path of root.find(api.jscodeshift.ImportDeclaration).filter(path => path.value.source.value === 'glamor'))
    path.value.source.value = 'glamor-jss';

  for (const path of root.find(api.jscodeshift.CallExpression))
    if ( path.value.callee.name === 'require' && path.value.arguments[0].value === 'glamor' )
      path.value.arguments[0].value = 'glamor-jss';

  return root.toSource({ quote: 'single' });
};
