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
import {wait} from '../promise-utils';

/**
 * Main class for the currency selection view.
 */
export class SelectView {
  /**
   * Constructor for the SelectView.
   * @param {App} app The instance of the main application.
   * @param {Object} model The model for the application.
   * @param {Element} screen The container element for this screen.
   * @param {AnimationHelper} animationHelper Animation helper instance.
   */
  constructor(app, model, screen, animationHelper) {
    this._app = app;
    this._model = model;
    this._screen = screen;
    this._animationHelper = animationHelper;
    this._populateSelection();
  }

  /**
   * Display the currency selection screen.
   * @param {Element} originScreen The container for the originating screen.
   * @param {Element} originElement The hero element for the transition.
   * @param {Object} currency The model subtree for the currency being selected.
   */
  show(originScreen, originElement, currency) {
    this._originScreen = originScreen;
    this._originElement = originElement;
    this._currency = currency;
    this._setSelectedCurrency(currency.code.value);

    this._animationHelper.scalingAnimation({
      startEl: this._originElement,
      targetEl: null,
      startScreen: this._originScreen,
      targetScreen: this._screen,
      transparentBg: true,
    });
    this._app.setAppTitle(`Select ${currency.metaText} currency`);
  }

  /**
   * Mark the currently selected currency in the list.
   * @param {String} code The 3-letter code for the currency.
   */
  _setSelectedCurrency(code) {
    let list = document.querySelector('.mm-select__list');
    let entries = list.querySelectorAll('.mm-select__item');

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].dataset.currency === code) {
        entries[i].classList.add('mm-select--selected');
      } else {
        entries[i].classList.remove('mm-select--selected');
      }
    }
  }

  /**
   * Populate the list with all the currencies in the model.
   */
  _populateSelection() {
    let list = document.querySelector('.mm-select__list');

    // Clear current set of currencies.
    while (list && list.firstChild) {
      list.removeChild(list.firstChild);
    }

    // Populate with new set of currencies.
    for (let [code, details] of this._model.currencies.value) {
      let li = document.createElement('li');
      li.classList.add('mm-select__item');
      li.classList.add('mdc-list-item');
      li.dataset.currency = code;
      let symbol = document.createElement('span');
      symbol.classList.add('mm-select__item-symbol');
      symbol.classList.add('mm-animation--circle');
      symbol.classList.add('mdc-list-item__start-detail');
      symbol.textContent = details.symbol;
      li.appendChild(symbol);
      let name = document.createElement('name');
      name.classList.add('mm-select__item-name');
      name.textContent = details.name;
      li.appendChild(name);

      li.addEventListener('click', () => {
        this._setSelectedCurrency(code);
        this._currency.code.value = code;

        wait(250).then(() => {
          this._animationHelper.scalingAnimation({
            startEl: symbol,
            targetEl: this._originElement,
            startScreen: this._screen,
            targetScreen: this._originScreen,
            transparentBg: true,
            fadeStartScreen: true,
            hideTarget: true,
            heroText: false,
          });

          if ('history' in window) {
            this._app.transitioning = true;
            history.back();
          }

          this._app.setAppTitle();
        });
      });

      list.appendChild(li);
    }
  }
}
