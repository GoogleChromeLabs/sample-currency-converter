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

import {fetchFile} from './promise-utils';

// Prefer requestIdleCallback, if available.
const injector = window.requestIdleCallback || window.requestAnimationFrame;

/**
 * Loads and injects a stylesheet into the document.
 * @param {String} path The path to the CSS file to be loaded.
 * @return {Promise} A promise which resolves when the CSS gets applied.
 */
export default function loadAndInjectStyles(path) {
  return fetchFile(path)
    .then((styles) => {
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;

      // Wait either for rIC or rAF then inject and return.
      return new Promise((resolve, reject) => {
        injector(() => {
          document.head.appendChild(styleEl);
          requestAnimationFrame(resolve);
        });
      });
    });
}
