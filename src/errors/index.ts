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

import {RequestError} from '@octokit/request-error';
import {RequestError as RequestErrorBody} from '@octokit/types';

interface SingleError {
  resource: string;
  code: string;
  field: string;
}

export class GitHubAPIError extends Error {
  body: RequestErrorBody | undefined;
  status: number;
  cause?: Error;
  constructor(requestError: RequestError, message?: string) {
    super(message ?? requestError.message);
    this.status = requestError.status;
    this.body = GitHubAPIError.parseErrorBody(requestError);
    this.name = GitHubAPIError.name;
    this.cause = requestError;
  }

  static parseErrorBody(requestError: RequestError): RequestErrorBody {
    return (requestError.response as {data: RequestErrorBody}).data;
  }

  static parseErrors(requestError: RequestError): SingleError[] {
    return GitHubAPIError.parseErrorBody(requestError).errors || [];
  }
}

export class AuthError extends GitHubAPIError {
  constructor(requestError: RequestError) {
    super(requestError, 'unauthorized');
    this.status = 401;
    this.name = AuthError.name;
  }
}

export class DuplicateReleaseError extends GitHubAPIError {
  tag: string;
  constructor(requestError: RequestError, tag: string) {
    super(requestError);
    this.tag = tag;
    this.name = DuplicateReleaseError.name;
  }
}

export class MissingReleaseNotesError extends Error {
  changelogContents: string;
  version: string;
  constructor(changelogContents: string, version: string) {
    super(`could not find changelog entry corresponding to release ${version}`);
    this.changelogContents = changelogContents;
    this.version = version;
    this.name = MissingReleaseNotesError.name;
  }
}
