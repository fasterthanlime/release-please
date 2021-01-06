exports['graphql-body-'] = {
  'query': 'query commitsWithFiles($cursor: String, $owner: String!, $repo: String!, $baseRef: String!, $perPage: Int, $maxFilesChanged: Int, $path: String) {\n          repository(owner: $owner, name: $repo) {\n            ref(qualifiedName: $baseRef) {\n              target {\n                ... on Commit {\n                  history(first: $perPage, after: $cursor, path: $path) {\n                    edges {\n                      node {\n                        ... on Commit {\n                          message\n                          oid\n                          associatedPullRequests(first: 1) {\n                            edges {\n                              node {\n                                ... on PullRequest {\n                                  number\n                                  mergeCommit {\n                                    oid\n                                  }\n                                  files(first: $maxFilesChanged) {\n                                    edges {\n                                      node {\n                                        path\n                                      }\n                                    }\n                                    pageInfo {\n                                      endCursor\n                                      hasNextPage\n                                    }\n                                  }\n                                }\n                              }\n                            }\n                          }\n                        }\n                      }\n                    }\n                    pageInfo {\n                      endCursor\n                      hasNextPage\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }',
  'variables': {
    'maxFilesChanged': 64,
    'owner': 'fasterthanlime',
    'path': null,
    'perPage': 100,
    'repo': 'rust-test-repo',
    'baseRef': 'refs/heads/master'
  }
}

exports['labels-rust-'] = {
  'labels': [
    'autorelease: pending'
  ]
}

exports['Rust run creates a release PR for non-monorepo 1'] = `
[
  [
    "CHANGELOG.md",
    {
      "content": "# Changelog\\n\\n### [0.123.5](https://www.github.com/fasterthanlime/rust-test-repo/compare/v0.123.4...v0.123.5) (1983-10-10)\\n\\n\\n### Bug Fixes\\n\\n* **deps:** update dependency com.google.cloud:google-cloud-spanner to v1.50.0 ([1f9663c](https://www.github.com/fasterthanlime/rust-test-repo/commit/1f9663cf08ab1cf3b68d95dee4dc99b7c4aac373))\\n* **deps:** update dependency com.google.cloud:google-cloud-storage to v1.120.0 ([fcd1c89](https://www.github.com/fasterthanlime/rust-test-repo/commit/fcd1c890dc1526f4d62ceedad561f498195c8939))\\n",
      "mode": "100644"
    }
  ],
  [
    "Cargo.toml",
    {
      "content": "[package]\\nname = \\"rust-test-repo\\"\\nversion = \\"0.123.5\\"\\n",
      "mode": "100644"
    }
  ]
]
`
