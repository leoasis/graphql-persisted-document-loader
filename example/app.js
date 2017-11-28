import query from './query.graphql';
import queryWithDeps from './query-with-deps.graphql';

const el = document.createElement('div');

el.innerHTML = `
  <h1>Document id: ${query.documentId}</h1>
  <pre>${JSON.stringify(query, null, 4)}</pre>
  <hr />
  <h1>Document id: ${queryWithDeps.documentId}</h1>
  <pre>${JSON.stringify(queryWithDeps, null, 4)}</pre>
`;

document.body.appendChild(el);
