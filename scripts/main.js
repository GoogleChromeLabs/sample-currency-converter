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

import loadAndInjectStyles from './css-loader';
import loadView from './view-loader';
import noPullToRefresh from './no-pull-to-refresh';

import AnimationHelper from './animation-helper';
import ModelEntry from './model';

import * as PromiseUtils from './promise-utils';
import * as Geo from './geo.js';
import * as Db from './db.js';

import {MDCSimpleMenu} from '@material/menu';
import {MDCRipple} from '@material/ripple';
import {MDCDialog} from '@material/dialog';
import {MDCSnackbar} from '@material/snackbar';

import WebFont from 'webfontloader';

const FONT_TIMEOUT = 300;

const VIEW_JS = {
  SELECT: 'scripts/views/select.js',
  SETTINGS: 'scripts/views/settings.js',
};
const EXTRA_STYLES = 'styles/styles.min.css';

/**
 * Formats a currency for display.
 * @param {number} value The value to format.
 * @return {string} The formatted value.
 */
function _formatCurrency(value) {
  const whole = Math.floor(Number(value));
  const decimal = Math.abs(Math.round((Number(value) % 1) * 100));
  const marker = (1.1).toLocaleString().charAt(1);

  if (decimal < 10) {
    return `${whole.toLocaleString()}${marker}0${decimal.toString()}`;
  }
  return `${whole.toLocaleString()}${marker}${decimal.toString()}`;
}

/**
 * The main class for the application.
 */
class App {
  /**
   * Constructor, takes no parameters.
   */
  constructor() {
    this.loadingClickHandler = () => {
      this._screens.loading.classList.add('mm-loading--visible');
    };
    // Add loading screen click handler, before anything else.
    document.addEventListener('click', this.loadingClickHandler);

    // Public property. Used for views to set transitioning state.
    this.transitioning = false;

    // Screen element references.
    this._screens = {
      animation: document.querySelector('.mm-animation'),
      convert: document.querySelector('.mm-convert'),
      select: document.querySelector('.mm-select'),
      loading: document.querySelector('.mm-loading'),
      settings: document.querySelector('.mm-settings'),
    };

    this._model = {
      home: {
        metaText: 'home',
        amount: new ModelEntry('home.amount'),
        computedAmount: new ModelEntry('home.computedAmount'),
        code: new ModelEntry('home.code'),
        name: new ModelEntry('home.name'),
        symbol: new ModelEntry('home.symbol'),
      },
      travel: {
        metaText: 'travel',
        amount: new ModelEntry('travel.amount'),
        computedAmount: new ModelEntry('travel.computedAmount'),
        code: new ModelEntry('travel.code'),
        name: new ModelEntry('travel.name'),
        symbol: new ModelEntry('travel.symbol'),
      },
      common: {
        first: {
          home: new ModelEntry('common.first.home'),
          travel: new ModelEntry('common.first.travel'),
        },
        second: {
          home: new ModelEntry('common.second.home'),
          travel: new ModelEntry('common.second.travel'),
        },
        third: {
          home: new ModelEntry('common.third.home'),
          travel: new ModelEntry('common.third.travel'),
        },
      },
      currencies: new ModelEntry(/* Not bindable */),
      rates: {
        date: new ModelEntry('rates.date'),
        relative: new ModelEntry('rates.relative'),
        message: new ModelEntry('rates.message'),
      },
      geo: {
        enabled: new ModelEntry('geo.enabled'),
      },
      settings: {
        notify: new ModelEntry('settings.notify'),
      },
    };

    // Disable pull-to-refresh.
    noPullToRefresh();

    // Set up animation helper for our screen transitions.
    this._animationHelper = new AnimationHelper(this._screens.animation);

    this._elements = {
      toolbar: document.querySelector('.mm-toolbar'),
      title: document.querySelector('.mm-toolbar__title'),
      titleBlock: document.querySelector('.mm-toolbar__title-block'),
      appName: document.querySelector('.mm-toolbar__appname'),
      card: document.querySelector('.mm-convert__card'),
      more: document.querySelector('.mm-toolbar__more'),
      backButton: document.querySelector('.mm-toolbar__back-button'),
    };

    // Load currency list.
    this._fetchCurrencies()
        // Initialize model.
        .then(() => this._initModel())
        // Choose default currencies.
        .then(() => this._loadCurrency('home').catch(() => {
          // Loading failed, choose a default
          this._model.home.code.value = 'USD';
        }))
        .then(() => this._loadCurrency('travel').catch(() => {
          // Loading failed, choose a default.
          this._model.travel.code.value =
              this._model.home.code.value === 'USD' ? 'EUR' : 'USD';
        }))
        // Initialize application logic and UI elements.
        .then(() => {
          this._init();
          this._initElements();
        });
  }

  /**
   * Initialize model. Sets up listeners for ensuring internal consistency.
   */
  _initModel() {
    const {home, travel, common} = this._model;

    const convertInModel = (from, to) => {
      const amount = from.amount.value;

      if (this._rates && (amount || amount === 0)) {
        from.computedAmount.value = null;
        to.computedAmount.value = _formatCurrency(
          this._convertValue(amount, from.code.value, to.code.value));
      }
    };

    // Update computed values when value changes.
    home.amount.listen(() => convertInModel(home, travel));
    travel.amount.listen(() => convertInModel(travel, home));

    // Update currency details when currency code changes.
    home.code.listen((code) => {
      home.name.value = this._model.currencies.value.get(code)['name'];
      home.symbol.value = this._model.currencies.value.get(code)['symbol'];
    });
    travel.code.listen((code) => {
      travel.name.value = this._model.currencies.value.get(code)['name'];
      travel.symbol.value = this._model.currencies.value.get(code)['symbol'];
    });

    const convertComputed = () => {
      if (home.computedAmount.value !== null) {
        convertInModel(travel, home);
      } else {
        convertInModel(home, travel);
      }
    };

    const convertCommon = () => {
      for (let row of ['first', 'second', 'third']) {
        if (this._rates) {
          common[row].travel.value = _formatCurrency(this._convertValue(
            common[row].home.value, home.code.value, travel.code.value));
        }
      }
    };

    // Update computed values when currency code changes.
    home.code.listen(() => {
      convertComputed();
      convertCommon();
    });
    travel.code.listen(() => {
      convertComputed();
      convertCommon();
    });

    // Update common values when each of them changes.
    for (let row of ['first', 'second', 'third']) {
      common[row].home.listen((val) => {
        if (this._rates) {
          common[row].travel.value = _formatCurrency(this._convertValue(
            common[row].home.value, home.code.value, travel.code.value));
        }
      });
    }
  }

  /**
   * Initialize application.
   */
  _init() {
    console.log('Init!');

    // Reveal currency labels.
    this._screens.convert.classList.add('mm-convert--has-currencies');

    // Load last travel currency.
    Db.loadFromStore('last-travel')
        .then((value) => (this._lastTravel = value))
        .catch(() => (this._lastTravel = null));

    // Prepare settings model listeners.
    this._model.geo.enabled.listen((value) =>
        Db.saveToStore('geo.enabled', value));
    this._model.settings.notify.listen((value) =>
        Db.saveToStore('settings.notify', value));

    // Load settings.
    const notifySettingsPromise = Db.loadFromStore('settings.notify')
        .then((enabled) => (this._model.settings.notify.value = enabled))
        .catch(() => (this._model.settings.notify.value = false));
    const geoSettingsPromise = Db.loadFromStore('geo.enabled')
        .then((enabled) => (this._model.geo.enabled.value = enabled))
        .catch(() => (this._model.geo.enabled.value = false));

    notifySettingsPromise.then(() => {
      this._model.settings.notify.listen((value) => {
        if (value) {
          Notification.requestPermission().then((result) => {
            if (result === 'denied') {
              this._model.settings.notify.value = false;
              this._snackbar.show({
                message: 'Cannot enable notifications because the ' +
                  'notifications permission has been disabled in the browser ' +
                  'settings. Please re-enable and try again.',
                timeout: 10000,
                multiline: true,
              });
            }
          });
        }
      });
    });

    geoSettingsPromise.then(() => {
      // Make initial geo request if the option is on.
      if (this._model.geo.enabled.value) {
        this._locate().catch((error) => {
          if ('type' in error && error.type === 'PositionError' &&
              error.inner.code === 1) {
            this._model.geo.enabled.value = false;
            this._snackbar.show({
              message: 'Cannot retrieve location because location access has ' +
                'been disabled in the browser.',
              timeout: 8000,
              multiline: true,
            });
          }
        });
      }

      // Set geo request to happen automatically on enable.
      this._model.geo.enabled.listen((value) => {
        if (value) {
          this._locate().catch((error) => {
            if ('type' in error && error.type === 'PositionError' &&
                error.inner.code === 1) {
              this._model.geo.enabled.value = false;
              this._snackbar.show({
                message: 'Cannot enable travel currency suggestion because ' +
                  'location access has been disabled in the browser ' +
                  'settings. Please re-enable and try again.',
                timeout: 10000,
                multiline: true,
              });
            }
          });
        }
      });
    });

    // Load rates from local storage, if available.
    const loadRates = this._loadRates()
        .then((rates) => rates, () => this._fetchRates());

    // Try to fetch latest rates, regardless. Schedule a fetch if that fails.
    PromiseUtils.after(loadRates, () =>
        this._fetchRates().catch(() => this._scheduleRateFetch()));

    const loadExtraCSS = loadAndInjectStyles(EXTRA_STYLES);
    loadExtraCSS.then(() => console.log('Styles loaded!'));

    const loadFonts = new Promise((resolve, reject) => {
      let done = 0;
      const checkDone = () => {
        done++;
        if (done === 7) {
          resolve();
        }
      };
      WebFont.load({
        google: {
          families: ['Roboto:i,300,400,500', 'Roboto Mono:i,400,700'],
        },
        fontactive: checkDone,
        inactive: resolve,
      });
    });

    // Give fonts some time to load before displaying anything on screen.
    // This allows us to avoid unsightly font changes when loading from cache,
    // but show the UI quickly if loading from the network.
    Promise.race([
      loadFonts,
      PromiseUtils.wait(FONT_TIMEOUT),
    ]).then(() => requestAnimationFrame(() =>
        this._screens.convert.classList.remove('mm-screen--hidden')));

    // Load common values, and provide defaults if things fail.
    const loadCommonValues = Promise.all([
      this._loadCommon('first').catch((err) => {
        this._model.common.first.home.value = 1;
      }),
      this._loadCommon('second').catch((err) => {
        this._model.common.second.home.value = 20;
      }),
      this._loadCommon('third').catch((err) => {
        this._model.common.third.home.value = 50;
      }),
    ]);

    const loadCountryMappings = this._fetchCountryMappings();

    Promise.all([
      loadCommonValues,
      loadRates,
    ]).then(() => {
      const marker = (1.1).toLocaleString().charAt(1);
      // Trigger recalc.
      this._model.home.code.value = this._model.home.code.value;
      this._model.home.amount.value = 1;
      this._homeBox.placeholder = `1${marker}00`;
      // Enable common values.
      this._screens.convert.classList.add('mm-convert--has-common');
      PromiseUtils.wait(200).then(() =>
          this._screens.convert.classList.add('mm-convert--has-common-end'));
    });

    this._booted = Promise.all([
      loadExtraCSS,
      loadCountryMappings,
      loadCommonValues,
      loadRates,
    ]);

    this._booted.then(() => {
      // Set up history handling for back button support.
      if ('history' in window) {
        // Add some state to current history location.
        history.replaceState({page: 'convert'}, 'Currency conversion');

        // Set up event listener for page navigation.
        window.addEventListener('popstate',
            (event) => this._handlePopState(event));
      }
    });

    // Lazily load view JS.
    this._selectViewPromise = loadView(VIEW_JS.SELECT)
        .then(() => this._booted)
        .then(() => new Views.SelectView(this, this._model,
            this._screens.select, this._animationHelper));

    this._settingsViewPromise = loadView(VIEW_JS.SETTINGS)
        .then(() => this._booted)
        .then(() => new Views.SettingsView(this, this._model,
            this._screens.settings, this._animationHelper));

    this._booted.then(() => this._hideLoadingScreen());

    // MDC-Web component init.

    MDCRipple.attachTo(document.querySelector('.mm-convert__update'));
    const menu =
        new MDCSimpleMenu(document.querySelector('.mdc-toolbar__menu'));

    this._snackbar = new MDCSnackbar(document.querySelector('.mm-snackbar'));

    // Add event listener to button to toggle the menu on and off.
    this._elements.more.addEventListener('click', () =>
        this._booted.then(() => (menu.open = !menu.open)));

    // Add event listener to open Settings screen.
    document.querySelector('.mm-menu__settings').addEventListener('click',
        () => this._settingsViewPromise.then((view) => {
          view.show(this._screens.convert);
          history.pushState({page: 'settings'}, 'Settings');
        }));

    const ratesDialog =
        new MDCDialog(document.querySelector('#mm-rates-dialog'));
    document.querySelector('.mm-menu__rates').addEventListener('click', () => {
      this._updateRateInfo();
      ratesDialog.show();
    });
    document.querySelector('.mm-convert__last-updated').addEventListener(
        'click', () => {
          this._updateRateInfo();
          ratesDialog.show();
        });

    const aboutDialog =
        new MDCDialog(document.querySelector('#mm-about-dialog'));
    document.querySelector('.mm-menu__about').addEventListener('click', () => {
      this._updateRateInfo();
      aboutDialog.show();
    });
  }

  /**
   * Initialize the main screen elements.
   */
  _initElements() {
    // Set up back button.
    this._elements.backButton.addEventListener('click', () => {
      if ('history' in window) {
        history.back();
        this.setAppTitle();
      }
    });

    const travelButton =
        document.querySelector('#convert-travel .mm-convert__currency');
    const homeButton =
        document.querySelector('#convert-home .mm-convert__currency');
    const updateButton =
        document.querySelector('.mm-convert__update');

    updateButton.addEventListener('click', () => this._booted.then(
        () => this._fetchRates(true).catch(() => this._scheduleRateFetch())));

    // Set up animations for conversion screen buttons.
    travelButton.addEventListener('click', () => this._selectViewPromise
        .then((view) => {
          view.show(this._screens.convert, travelButton, this._model.travel);
          history.pushState({page: 'select', currency: 'travel'},
              'Select travel currency');
        })
    );
    homeButton.addEventListener('click', () => this._selectViewPromise
        .then((view) => {
          view.show(this._screens.convert, homeButton, this._model.home);
          history.pushState({page: 'select', currency: 'home'},
              'Select home currency');
        })
    );

    this._travelBlock = document.querySelector('#convert-travel');
    this._homeBlock = document.querySelector('#convert-home');
    this._travelBox =
        document.querySelector('#convert-travel .mm-convert__value');
    this._homeBox = document.querySelector('#convert-home .mm-convert__value');

    // Set up event listeners for modifying the model.
    this._travelBox.addEventListener('input', () => this._booted.then(() => {
      this._model.travel.amount.value = parseFloat(this._travelBox.value);
      this._validateInput('travel');
    }));
    this._homeBox.addEventListener('input', () => this._booted.then(() => {
      this._model.home.amount.value = parseFloat(this._homeBox.value);
      this._validateInput('home');
    }));

    // Set up model listeners for input boxes.
    // Note: Programmatic value changes don't trigger DOM events, so we avoid
    // infinite loops.
    this._model.home.computedAmount.listen((value) => {
      // A real computed value means we should clear the input.
      if (value !== null) {
        this._homeBox.placeholder = value;
        this._homeBox.value = '';
      }
      // If we have a computed value, it's probably because the other box has
      // a value, so let's check if we can clear the placeholder.
      if (this._travelBox.value !== '') {
        this._travelBox.placeholder = '';
      }
    });
    this._model.travel.computedAmount.listen((value) => {
      // A real computed value means we should clear the input.
      if (value !== null) {
        this._travelBox.value = '';
        this._travelBox.placeholder = value;
      }
      // If we have a computed value, it's probably because the other box has
      // a value, so let's check if we can clear the placeholder.
      if (this._homeBox.value !== '') {
        this._homeBox.placeholder = '';
      }
    });

    // Set up storage for currencies.
    this._model.home.code.listen((code) => Db.saveToStore('home', code));
    this._model.travel.code.listen((code) => Db.saveToStore('travel', code));

    // Set up storage for common values.
    this._model.common.first.home.listen((value) =>
        Db.saveToStore('common.first', value));
    this._model.common.second.home.listen((value) =>
        Db.saveToStore('common.second', value));
    this._model.common.third.home.listen((value) =>
        Db.saveToStore('common.third', value));
  }

  /**
   * Sets the app title. Changes the UI to a subscreen, with back button and
   * subscreen text.
   * @param {string} text The text for the subscreen. Null means home.
   */
  setAppTitle(text = null) {
    if (text !== null) {
      this._elements.toolbar.classList.add('mm-toolbar--subscreen');
      this._elements.title.textContent = text;
      this._elements.appName.setAttribute('aria-hidden', true);
      this._elements.titleBlock.removeAttribute('aria-hidden');
      this._elements.backButton.removeAttribute('aria-hidden');
      this._elements.more.setAttribute('aria-hidden', true);
    } else {
      this._elements.toolbar.classList.remove('mm-toolbar--subscreen');
      setTimeout(() => (this._elements.title.textContent = ''), 500);
      this._elements.appName.removeAttribute('aria-hidden');
      this._elements.titleBlock.setAttribute('aria-hidden', true);
      this._elements.backButton.setAttribute('aria-hidden', true);
      this._elements.more.removeAttribute('aria-hidden');
    }
  }

  /**
   * Handles a pop state in the history.
   * @param {Event} event The event to handle.
   */
  _handlePopState(event) {
    if (event && event.state && event.state.page && !this.transitioning) {
      if (event.state.page === 'convert') {
        // Get currently active screen.
        const current =
            document.querySelector('.mm-screen:not(.mm-screen--disabled)');
        this._animationHelper.fadingAnimation(current, this._screens.convert);
        this.setAppTitle();
      }
    }
    this.transitioning = false;
  }

  /**
   * Converts an amount between currencies.
   * @param {number} value The amount to convert.
   * @param {string} fromCur The 3-letter code of the currency to convert from.
   * @param {string} toCur The 3-letter code of the currency to convert to.
   * @return {number} The converted amount.
   */
  _convertValue(value, fromCur, toCur) {
    let conversion = null;
    value = value || 0;

    if (fromCur === toCur) {
      conversion = value;
    } else if (toCur === this._rates.base) {
      conversion = value / this._rates.rates[fromCur];
    } else if (fromCur === this._rates.base) {
      conversion = value * this._rates.rates[toCur];
    } else {
      conversion =
          value * this._rates.rates[toCur] / this._rates.rates[fromCur];
    }

    return Math.round(conversion * 100) / 100;
  }

  /**
   * Updates the UI with the current rates.
   */
  _updateRateInfo() {
    if (this._rates) {
      const day = 24 * 60 * 60 * 1000;
      const rateDate = new Date(`${this._rates.date}T00:00:00`);
      const daysToday = new Date().getTime() / day;
      const daysRates = rateDate.getTime() / day;
      const days = Math.floor(daysToday - daysRates);

      this._model.rates.date.value = rateDate.toISOString().split('T', 1)[0];

      this._model.rates.message.value = 'Rates updated ';
      if (days === 0) {
        this._model.rates.relative.value = 'today';
      } else {
        this._model.rates.relative.value =
            `${days} day${days === 1 ? '' : 's'} ago`;
      }
    }
  }

  /**
   * Returns a promise for loading the rates from IndexedDB. Also updates the
   * member variables.
   *
   * @return {Promise.<Object>} Promise with the loaded rates.
   */
  _loadRates() {
    return Db.loadFromStore('rates').then((value) => {
      this._rates = value;
      this._updateRateInfo();
      return value;
    });
  }

  /**
   * Returns a promise for loading the rates from IndexedDB.
   * Also updates the member variables.
   *
   * @return {Promise} Promise for the storage success.
   */
  _storeRates() {
    return Db.saveToStore('rates', this._rates);
  }

  /**
   * Returns a promise for loading a currency from IndexedDB.
   * Also updates the member variables.
   *
   * @param {string} key One of 'home' or 'travel'.
   * @return {Promise.<Object>} Promise with the loaded rates.
   */
  _loadCurrency(key) {
    if (key !== 'home' && key !== 'travel') {
      throw new Error(`Invalid currency key: ${key}.`);
    }
    return Db.loadFromStore(key).then((value) => {
      if (!value || String(value).length !== 3) {
        throw new Error(`Invalid ${key} currency.`);
      }
      this._model[key].code.value = value;
      return value;
    });
  }

  /**
   * Returns a promise for loading a common value from IndexedDB.
   * Also updates the member variables.
   *
   * @param {string} key One of 'first', 'second' or 'third'.
   * @return {Promise.<Object>} Promise with the loaded common values.
   */
  _loadCommon(key) {
    if (key !== 'first' && key !== 'second' && key !== 'third') {
      throw new Error(`Invalid common value key: ${key}.`);
    }
    return Db.loadFromStore(`common.${key}`).then((value) => {
      if (!value && value !== 0) {
        throw new Error(`Undefined: common.${key}.`);
      }
      this._model.common[key].home.value = value;
      return value;
    });
  }

  /**
   * Returns a promise for the currency rates. Fails if it takes too long.
   *
   * @param {boolean} forceUpdate Whether to force an update by cache busting.
   * @return {Promise.<Object>} The constructed promise.
   */
  _fetchRates(forceUpdate = false) {
    const RATE_URL = '/rates';
    const MESSAGE = 'Error getting rates.';
    const ACCEPTABLE_TIMEOUT = 5000;

    let url = forceUpdate ? `${RATE_URL}?${new Date().getTime()}` : RATE_URL;

    return PromiseUtils.fetchJson(url, MESSAGE, ACCEPTABLE_TIMEOUT).then(
        (result) => {
          this._rates = result;
          this._updateRateInfo();
          this._storeRates();
          return result;
        }
    );
  }

  /**
   * Schedule an update of the rates for when the user has connectivity.
   */
  _scheduleRateFetch() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('rates').then(() => this._loadRates());
      });
    }
  }

  /**
   * Returns a promise for the country to currency mapping data.
   *
   * @return {Promise.<Object>} The constructed promise.
   */
  _fetchCountryMappings() {
    const COUNTRY_CURRENCIES = 'data/country-currencies.json';
    const MESSAGE = 'Error loading country to currency data.';

    return PromiseUtils.fetchJson(COUNTRY_CURRENCIES, MESSAGE).then(
        (result) => (this._countryCurrencies = result));
  }

  /**
   * Returns a promise for the currency data.
   *
   * @return {Promise.<Object>} The constructed promise.
   */
  _fetchCurrencies() {
    const CURRENCIES = 'data/currencies.json';
    const MESSAGE = 'Error loading currency data.';

    return PromiseUtils.fetchJson(CURRENCIES, MESSAGE).then(
        (result) => (this._model.currencies.value = new Map(result)));
  }

  /**
   * Identify country and currency, based on geo data.
   * @param {Object} geoData The geo data returned by the Google Maps API.
   * @return {Object} An object containing country and currency data.
   */
  _identifyCountryAndCurrency(geoData) {
    if (geoData && geoData.status === 'OK' && geoData.results &&
        geoData.results[0]) {
      const bestGuess = geoData.results[0];
      const country = bestGuess.address_components.find((item) =>
          item.types.includes('country'));

      if (country) {
        return {
          countryCode: country.short_name,
          countryName: country.long_name,
          currency: this._countryCurrencies[country.short_name],
        };
      }
    }
    return null;
  }

  /**
   * Hide the loading screen, once the application is done booting.
   */
  _hideLoadingScreen() {
    document.body.classList.add('mm-app--booted');
    this._screens.loading.classList.add('mm-loading--hidden');
    this._screens.loading.setAttribute('aria-hidden', true);
    document.removeEventListener('click', this.loadingClickHandler);
  }

  /**
   * Validate the provided input field.
   * @param {string} type One of 'home' or 'travel'.
   */
  _validateInput(type) {
    let input = null;
    let block = null;
    let otherBlock = null;

    if (type === 'home') {
      input = this._homeBox;
      block = this._homeBlock;
      otherBlock = this._travelBlock;
    } else {
      input = this._travelBox;
      block = this._travelBlock;
      otherBlock = this._homeBlock;
    }

    const isEmpty = input.value === '' && input.validity &&
        input.validity.valid;

    if (!isEmpty && isNaN(parseFloat(input.value))) {
      this._elements.card.classList.add('mm-convert--invalid');
      block.classList.add('mm-convert--invalid');
      block.querySelector('.mm-convert__error').removeAttribute('aria-hidden');
      otherBlock.classList.remove('mm-convert--invalid');
      otherBlock.querySelector('.mm-convert__error').setAttribute(
          'aria-hidden', true);
    } else {
      this._elements.card.classList.remove('mm-convert--invalid');
      block.classList.remove('mm-convert--invalid');
      otherBlock.classList.remove('mm-convert--invalid');
      block.querySelector('.mm-convert__error').setAttribute(
          'aria-hidden', true);
      otherBlock.querySelector('.mm-convert__error').setAttribute(
          'aria-hidden', true);
    }
  }

  /**
   * Locates the user and triggers UI prompt, if relevant.
   * @return {Promise} Promise with the country and currency details.
   */
  _locate() {
    return Geo.getCurrentPosition()
        .then((pos) => Geo.reverseGeocode(pos))
        .then((data) => this._identifyCountryAndCurrency(data))
        .then((details) => {
          if (details) {
            const code = details.currency;
            const name = this._model.currencies.value.get(code)['name'];

            let formattedCountryName = details.countryName;
            // Yay, language exceptions.
            const contriesThatNeedThe = ['United', 'Netherlands'];
            for (let i = 0; i < contriesThatNeedThe.length; i++) {
              if (formattedCountryName.indexOf(contriesThatNeedThe[i]) === 0) {
                formattedCountryName = `the ${formattedCountryName}`;
              }
            }

            if (code && code !== this._model.home.code.value &&
                code !== this._lastTravel) {
              this._snackbar.show({
                message: `Welcome to ${formattedCountryName}! Would you like ` +
                  `to change your travel currency to '${name}' (${code})?`,
                timeout: 20000,
                multiline: true,
                actionOnBottom: true,
                actionText: `Change to ${code}`,
                actionHandler: () => {
                  this._model.travel.code.value = code;
                  // Fix bug with MDC-Web snackbar; force it to hide.
                  document.querySelector('.mm-snackbar').classList.remove(
                      'mdc-snackbar--active');
                },
              });
              this._lastTravel = code;
              Db.saveToStore('last-travel', this._lastTravel);
            }
          }
          return details;
        });
  }
}

let app = new App();
window.app = app;
