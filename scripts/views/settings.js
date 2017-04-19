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
import {MDCTextfield} from '@material/textfield';

/**
 * Main class for the settings view.
 */
export class SettingsView {
  /**
   * Constructor for the SettingsView.
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

    const geoControl = this._screen.querySelector('#mm-settings-geo');
    const notifyControl = this._screen.querySelector('#mm-settings-notify');

    // Set initial values and listen to model changes.
    geoControl.checked = this._model.geo.enabled.value;
    notifyControl.checked = this._model.settings.notify.value;
    this._model.geo.enabled.listen((value) => (geoControl.checked = value));
    this._model.settings.notify.listen((value) =>
        (notifyControl.checked = value));

    // Add event listeners.
    geoControl.addEventListener('change', () => {
      this._model.geo.enabled.value = geoControl.checked;
    });
    notifyControl.addEventListener('change', () => {
      this._model.settings.notify.value = notifyControl.checked;
    });

    // Handle common values.
    this._commonValues = [];
    const commonValueControls =
        this._screen.querySelectorAll('.mm-js-common-value');

    const labels = ['first', 'second', 'third'];

    for (let i = 0; i < commonValueControls.length; i++) {
      const control = commonValueControls[i];
      const input = control.querySelector('input');
      this._commonValues.push(new MDCTextfield(control));

      // Update model when values change.
      input.addEventListener('change', () => {
        if (input.value !== '') {
          this._model.common[labels[i]].home.value = parseFloat(input.value);
        }
      });

      // Set initial values and listen to model changes.
      input.value = this._model.common[labels[i]].home.value;
      this._model.common[labels[i]].home.listen((val) => (input.value = val));
    }
  }

  /**
   * Display the settings screen.
   * @param {Element} originScreen The container for the originating screen.
   */
  show(originScreen) {
    this._originScreen = originScreen;

    this._animationHelper.fadingAnimation(this._originScreen, this._screen);
    this._app.setAppTitle('Settings');
  }
}
