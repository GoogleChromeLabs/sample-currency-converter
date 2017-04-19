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
 * Loads and injects a view's JS into the document.
 * @param {String} path The path to the JS file to be loaded.
 * @return {Promise} A promise which resolves when the JS gets loaded.
 */
export default function loadView(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.onerror = reject;
    script.onload = resolve;
    document.head.appendChild(script);
    script.src = path;
  });
}
