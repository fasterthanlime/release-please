// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as assert from 'assert';
import {describe, it, afterEach} from 'mocha';
import * as nock from 'nock';
import {Rust} from '../../src/releasers/rust';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import * as snapshot from 'snap-shot-it';
import * as suggester from 'code-suggester';
import * as sinon from 'sinon';

const sandbox = sinon.createSandbox();
const fixturesPath = './test/releasers/fixtures/rust';

function mockRequest(opts: {monorepo: boolean}) {
  const snapName = opts.monorepo ? 'monorepo' : 'non-monorepo';

  const crate1Manifest = readFileSync(
    resolve(fixturesPath, 'Cargo-crate1.toml'),
    'utf8'
  );
  const crate2Manifest = readFileSync(
    resolve(fixturesPath, 'Cargo-crate2.toml'),
    'utf8'
  );
  const workspaceManifest = readFileSync(
    resolve(fixturesPath, 'Cargo-workspace.toml'),
    'utf8'
  );
  const graphql = JSON.parse(
    readFileSync(resolve(fixturesPath, 'commits.json'), 'utf8')
  );

  let req = nock('https://api.github.com')
    // This step checks for an existing open release PR:
    .get('/repos/fasterthanlime/rust-test-repo/pulls?state=open&per_page=100')
    .reply(200, [])
    // check for default branch
    .get('/repos/fasterthanlime/rust-test-repo')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .reply(200, require('../../../test/fixtures/repo-get-1.json'))
    .get(
      '/repos/fasterthanlime/rust-test-repo/pulls?state=closed&per_page=100&sort=merged_at&direction=desc'
    )
    .reply(200, undefined)
    // workspace manifest or single-crate manifest, depending
    .get(
      '/repos/fasterthanlime/rust-test-repo/contents/Cargo.toml?ref=refs/heads/master'
    )
    .reply(() => {
      const manifest = opts.monorepo ? workspaceManifest : crate1Manifest;

      return [
        200,
        {
          content: Buffer.from(manifest, 'utf8').toString('base64'),
          sha: 'abc123',
        },
      ];
    })
    // fetch semver tags, this will be used to determine
    // the delta since the last release.
    .get(
      '/repos/fasterthanlime/rust-test-repo/pulls?state=closed&per_page=100&sort=merged_at&direction=desc'
    )
    .reply(200, [
      {
        base: {
          label: 'fasterthanlime:master',
        },
        head: {
          label: `fasterthanlime:release-${
            opts.monorepo ? 'crate1-' : ''
          }v0.123.4`,
          sha: 'da6e52d956c1e35d19e75e0f2fdba439739ba364',
        },
        merged_at: new Date().toISOString(),
        labels: [],
      },
    ])
    .post('/graphql', (body: object) => {
      let path = (body as {variables: {path?: string}}).variables.path || '';
      path = path.replace(/![a-zA-Z0-9]/g, '-');
      snapshot(`graphql-body-${snapName}-${path}`, body);
      return true;
    })
    .times(opts.monorepo ? 2 : 1)
    .reply(200, {
      data: graphql,
    })
    .post(
      '/repos/fasterthanlime/rust-test-repo/issues/22/labels',
      (req: {[key: string]: string}) => {
        snapshot(`labels-rust-${snapName}`, req);
        return true;
      }
    )
    .reply(200, {})
    // this step tries to close any existing PRs; just return an empty list.
    .get('/repos/fasterthanlime/rust-test-repo/pulls?state=open&per_page=100')
    .reply(200, []);

  if (opts.monorepo) {
    req = req
      // crate1 manifest
      .get(
        '/repos/fasterthanlime/rust-test-repo/contents/crates%2Fcrate1%2FCargo.toml?ref=refs/heads/master'
      )
      .reply(200, {
        content: Buffer.from(crate1Manifest, 'utf8').toString('base64'),
        sha: 'abc123',
      })
      // crate2 manifest
      .get(
        '/repos/fasterthanlime/rust-test-repo/contents/crates%2Fcrate2%2FCargo.toml?ref=refs/heads/master'
      )
      .reply(200, {
        content: Buffer.from(crate2Manifest, 'utf8').toString('base64'),
        sha: 'abc123',
      })
      // crate1 CHANGELOG
      .get(
        '/repos/fasterthanlime/rust-test-repo/contents/crates%2Fcrate1%2FCHANGELOG.md?ref=refs%2Fheads%2Fmaster'
      )
      .reply(404);
  } else {
    req = req
      // check for CHANGELOG
      .get(
        '/repos/fasterthanlime/rust-test-repo/contents/CHANGELOG.md?ref=refs%2Fheads%2Fmaster'
      )
      .reply(404)
      // update Cargo.toml
      .get(
        '/repos/fasterthanlime/rust-test-repo/contents/Cargo.toml?ref=refs%2Fheads%2Fmaster'
      )
      .reply(200, {
        content: Buffer.from(crate1Manifest, 'utf8').toString('base64'),
        sha: 'abc123',
      });
  }

  return req;
}

describe('Rust', () => {
  afterEach(() => {
    sandbox.restore();
  });
  describe('run', () => {
    it('creates a release PR for non-monorepo', async () => {
      // We stub the entire suggester API, asserting only that the
      // the appropriate changes are proposed:
      let expectedChanges = null;
      sandbox.replace(
        suggester,
        'createPullRequest',
        (_octokit, changes): Promise<number> => {
          expectedChanges = [...(changes as Map<string, object>)]; // Convert map to key/value pairs.
          return Promise.resolve(22);
        }
      );

      const req = mockRequest({monorepo: false});

      const releasePR = new Rust({
        repoUrl: 'fasterthanlime/rust-test-repo',
        releaseType: 'rust',
        packageName: 'crate1',
        apiUrl: 'https://api.github.com',
      });
      await releasePR.run();
      req.done();
      snapshot(
        JSON.stringify(expectedChanges, null, 2).replace(
          /[0-9]{4}-[0-9]{2}-[0-9]{2}/,
          '1983-10-10' // don't save a real date, this will break tests.
        )
      );
    });

    it('creates a release PR for monorepo', async () => {
      // We stub the entire suggester API, asserting only that the
      // the appropriate changes are proposed:
      let expectedChanges = null;
      sandbox.replace(
        suggester,
        'createPullRequest',
        (_octokit, changes): Promise<number> => {
          expectedChanges = [...(changes as Map<string, object>)]; // Convert map to key/value pairs.
          return Promise.resolve(22);
        }
      );

      const req = mockRequest({monorepo: true});

      const releasePR = new Rust({
        repoUrl: 'fasterthanlime/rust-test-repo',
        releaseType: 'rust',
        packageName: 'crate1',
        apiUrl: 'https://api.github.com',
        path: 'crates/crate1',
        monorepoTags: true,
      });
      await releasePR.run();
      req.done();
      snapshot(
        JSON.stringify(expectedChanges, null, 2).replace(
          /[0-9]{4}-[0-9]{2}-[0-9]{2}/,
          '1983-10-10' // don't save a real date, this will break tests.
        )
      );
    });

    it('does not support snapshot releases', async () => {
      const releasePR = new Rust({
        repoUrl: 'fasterthanlime/rust-test-repo',
        releaseType: 'rust',
        packageName: 'crate1',
        apiUrl: 'https://api.github.com',
        snapshot: true,
      });
      const pr = await releasePR.run();
      assert.strictEqual(pr, undefined);
    });
  });
});
