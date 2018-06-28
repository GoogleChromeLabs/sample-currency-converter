/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Returns a promise that succeeds automatically after a specified timeout.
 *
 * @param {number} timeout The timeout, in milliseconds.
 * @return {Promise} The constructed promise.
 */
export function wait(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * Returns a promise that executes the callback after the provided promise,
 * regardless of whether it succeedd or failed.
 *
 * @param {Promise} promise The promise to execute after.
 * @param {function} callback The callback to execute.
 * @return {Promise} The constructed promise.
 */
export function after(promise, callback) {
  return promise.then(callback, callback);
}

/**
 * Returns a promise for fetching a JSON URL, with customizable error string
 * and timeout.
 *
 * @param {string} url The URL to fetch.
 * @param {string} errorString The error string to use for any failures.
 * @param {number} timeout The timeout to use for the request.
 * @return {Promise.<Object>} The constructed promise.
 */
export function fetchJson(url, errorString = 'Error fetching data.',
  timeout = 0) {
  return fetchFile(url, errorString, timeout, 'json');
}

/**
 * Returns a promise for fetching a URL, with customizable error string
 * and timeout.
 *
 * @param {string} url The URL to fetch.
 * @param {string} errorString The error string to use for any failures.
 * @param {number} timeout The timeout to use for the request.
 * @param {string} responseType The response type for the request (e.g. 'json').
 * @return {Promise.<Object>} The constructed promise.
 */
export function fetchFile(url, errorString = 'Error fetching data.',
  timeout = 0, responseType = '') {
  return new Promise((resolve, reject) => {
    let req = new XMLHttpRequest();
    req.open('GET', url);
    req.timeout = timeout;

    req.addEventListener('load', () => {
      if (req.status === 200) {
        resolve(req.response);
      } else {
        reject(new Error(errorString + ` HTTP ${req.statusText}.`));
      }
    });

    let errorHandler = () => {
      reject(new Error(errorString));
    };
    req.addEventListener('error', errorHandler);
    req.addEventListener('abort', errorHandler);

    req.addEventListener('timeout', () => {
      reject(new Error(errorString + ' Request timed out.'));
    });

    req.responseType = responseType;
    req.send();
  });
}
