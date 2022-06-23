// workaround for __dirname in esm
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function appendLineToFile(filePath, line) {
  const file = readFileSync(filePath, 'utf8');
  const lines = file.split('\n');
  lines.push(line);
  writeFileSync(filePath, lines.join('\n'));
}

function logMessage(...message) {
  console.log(...message);
  appendLineToFile(resolve('.', './log.txt'), ' - ' + message.join(' '));
}

function addRumAddition(j, rootSource, sampleRUM, rumAddition) {
  const source = readFileSync(resolve(__dirname, `./templates/rum-${rumAddition}.js`), 'utf8');
  const path = j(source);

  const replacementAssignment = path.find(j.AssignmentExpression);

  const found = rootSource
    .find(j.ExpressionStatement)
    .find(j.AssignmentExpression)
    .filter(path => path.value.left.object)
    .filter(path => path.value.left.object.name === 'sampleRUM')
    .filter(path => path.value.left.property)
    .filter(path => path.value.left.property.name === rumAddition)
    .map(path => path.parent)
    .replaceWith(replacementAssignment.toSource());

  if (found.length === 0) {
    logMessage('adding missing rum addition', rumAddition);
    sampleRUM.insertAfter(replacementAssignment.toSource());
    if (rumAddition === 'observe') {
      // also invoke the observer after main blocks have been decorated
      logMessage('adding observe invocations');

      rootSource
        .find(j.CallExpression)
        .filter(path => path.value.callee.name === 'decorateBlocks')
        .map(path => path.parent)
        .insertAfter(`window.setTimeout(() => sampleRUM.observe(main.querySelectorAll('picture > img')), 1000);`)
        .insertAfter(`sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));`);
    }
  } else {
    console.log('successfully replaced rum addition', rumAddition);
  }
}

module.exports = function (fileInfo, api, options) {
  const j = api.jscodeshift;
  const rootSource = j(fileInfo.source);

  extractGeneration(rootSource, j);


  const sampleRUM = rootSource
    .find(j.FunctionDeclaration)
    .filter(path => path.value.id.loc.identifierName === 'sampleRUM')
    .map(path => path.parent);


  const rumAdditions = ['blockobserver', 'mediaobserver', 'observe', 'targetselector', 'sourceselector'];

  if (sampleRUM.length) {
    rumAdditions
      .reverse()
      .forEach(rumAddition => {
        addRumAddition(j, rootSource, sampleRUM.get(), rumAddition);
      });
    //addRumAddition(j, rootSource, sampleRUM.get(), 'mediaobserver');

    replaceWebVitalsLoader(sampleRUM, j);

    replaceClickListener(rootSource, j);

    const windowonerror = rootSource
      .find(j.ExpressionStatement)
      .find(j.AssignmentExpression)
      .filter(path => path.value.left.object)
      .filter(path => path.value.left.object.name === 'window')
      .filter(path => path.value.left.property)
      .filter(path => path.value.left.property.name === 'onerror')
      .find(j.CallExpression)
      .filter(path => path.value.callee.name === 'sampleRUM')
      .map(path => path.parent.parent.parent.parent.parent)
      .remove();

    if (windowonerror.length) {
      rootSource
        .find(j.VariableDeclarator)
        .filter(path => path.value.id.name === 'olderror')
        .map(path => path.parent)
        .remove();
    }

    replaceGenericListener(rootSource, j, 'window', 'error',
      `sampleRUM('error', { source: event.filename, target: event.lineno });`);

    replaceGenericListener(rootSource, j, 'window', 'unhandledrejection',
      `sampleRUM('error', { source: event.reason.sourceURL, target: event.reason.line });`);
  }

  //console.log(rootSource.toSource());
  return rootSource.toSource();
};

function replaceGenericListener(rootSource, j, target, event, source) {
  const replaced = rootSource
    .find(j.CallExpression)
    .filter(path => path.value.callee.type === 'MemberExpression')
    .filter(path => path.value.callee.object.name === target)
    .filter(path => path.value.callee.property.name === 'addEventListener')
    .filter(path => path.value.arguments[0].value === event)
    .filter(path => j(path).find(j.CallExpression).filter(p => p.value.callee.name === 'sampleRUM').length !== 0)
    //.find(j.CallExpression)
    //.filter(path => path.value.callee.name === 'sampleRUM')
    .map(path => path.parent)
    .replaceWith(`${target}.addEventListener('${event}', (event) => {
  ${source}
});`);

  // console.log('replaced', replaced.length === 1 && j(replaced.get().parent).toSource());

  if (replaced.length === 0) {
    logMessage('adding event listener for', event);
    rootSource
      .find(j.CallExpression)
      .filter(path => path.value.callee.name === 'sampleRUM')
      .filter(path => path.value.arguments[0].value === 'top')
      .map(path => path.parent)
      .insertAfter(`${target}.addEventListener('${event}', event => {
  ${source}
});`);
  } else {
    console.log('successfully replaced ' + event + ' listener');
  }
}

function replaceClickListener(rootSource, j) {
  const source = `sampleRUM('click', { target: sampleRUM.targetselector(event.target), source: sampleRUM.sourceselector(event.target) });`;

  return replaceGenericListener(rootSource, j, 'document', 'click', source);
}

function replaceWebVitalsLoader(sampleRUM, j) {
  const replaced = sampleRUM
    .find(j.CallExpression)
    .filter(path => path.value.callee.object)
    .filter(path => path.value.callee.object.type === 'ImportExpression')
    .filter(path => path.value.callee.object.source.value && path.value.callee.object.source.value.includes('web-vitals-module'))
    .map(path => path.parent)
    .replaceWith(readFileSync(resolve(__dirname, `./templates/rum-web-vitals-loader.js`), 'utf8'));
  if (replaced.length) {
    logMessage('update web vitals loader to helix-provided version');
  }
}

function extractGeneration(rootSource, j) {
  let oldGeneration;

  // find literal generation value
  rootSource
    .find(j.FunctionDeclaration).filter(path => path.value.id.loc.identifierName === 'sampleRUM')
    .find(j.VariableDeclarator).filter(vpath => vpath.value.id.name === 'sendPing')
    .find(j.VariableDeclarator).filter(vpath => vpath.value.id.name === 'body')
    .find(j.CallExpression)
    .find(j.ObjectExpression)
    .find(j.Property).filter(ppath => ppath.value.key.name === 'generation')
    .filter(core => j(core.value.value).toSource() !== 'window.RUM_GENERATION')
    .filter(core => j(core.value.value).toSource() !== 'RUM_GENERATION')
    .forEach(core => {
      oldGeneration = core.value.value;

      core.value.value = j.memberExpression(
        j.identifier('window'),
        j.identifier('RUM_GENERATION'),
        false);
      // console.log('after', j(core).toSource());
    });

  // set it at the end of the file
  if (oldGeneration && !rootSource
    .find(j.ExpressionStatement)
    .find(j.AssignmentExpression)
    .find(j.Identifier).filter(id => id.value.name === 'RUM_GENERATION')
    .length) {
    // inject the old generation into the body
    rootSource.find(j.Program).forEach(p => {
      p.value.body.push(j.expressionStatement(
        j.assignmentExpression(
          '=',
          j.memberExpression(
            j.identifier('window'),
            j.identifier('RUM_GENERATION'),
            false),
          oldGeneration
        )
      ));
    });
    logMessage('set RUM_GENERATION in user code');
  }
}
