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
 * Represents an entry in the model.
 */
export default class ModelEntry {
  /**
   * Constructor for ModelEntry.
   * @param {string} name The unique name used for binding to this entry.
   * @param {*} value The initial value to assign
   * @param {[function(value)]} listeners The initial set of listeners to add.
   */
  constructor(name = null, value = null, listeners = []) {
    this._name = name;
    this._value = value;
    this._listeners = listeners;
    this._bound =
      this._name ? document.querySelectorAll(`[data-mm-bind='${name}']`) : [];
  }

  /**
   * Getter for the value of the entry.
   * @return {*} The value.
   */
  get value() {
    return this._value;
  }

  /**
   * Setter for the value of the entry.
   * @param {*} val The value.
   */
  set value(val) {
    this._value = val;

    for (const listener of this._listeners) {
      listener(this._value);
    }

    for (let i = 0; i < this._bound.length; i++) {
      this._bound[i].textContent = this._value;
    }
  }

  /**
   * Attach a listener to this entry, to be notified of changes.
   * @param {function(val)} listener The listening function to attach.
   */
  listen(listener) {
    this._listeners.push(listener);
  }

  /**
   * Detach a listener from this entry.
   * @param {function(val)} listener The listening function to detach.
   */
  unlisten(listener) {
    const index = this._listeners.indexOf(listener);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }
}
