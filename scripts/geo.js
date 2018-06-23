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

import {
  fetchJson,
} from './promise-utils';

/**
 * Represents an error thrown by this module.
 */
export class GeoError {
  /**
   *
   * @param {string} type The error type.
   * @param {Object} inner The inner error, if any.
   * @param {string} message The custom error message.
   */
  constructor(type, inner = null, message = null) {
    this.type = type;
    this.inner = inner;
    this.message = this.inner ? this.inner.message : this.message;
    if (message) {
      this.message = message;
    }
  }
}

/**
 * Returns a promise for the current position.
 *
 * @return {Promise.<Position>} The constructed promise.
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    let success = (position) => resolve(position);
    let failure = (error) => reject(new GeoError('PositionError', error));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(success, failure, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 1 * 60 * 60 * 1000,
      });
    } else {
      reject(new GeoError('Unsupported', null, 'Geo location not supported.'));
    }
  });
}

/**
 * Returns a promise for reversed geo data for the provided position, using
 * the Google Maps API.
 *
 * @param {Position} position The position to get data for.
 * @return {Promise.<Object>} The constructed promise.
 */
export function reverseGeocode(position) {
  const GEO_REQ = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=';

  if (position && position.coords && 'latitude' in position.coords &&
    'longitude' in position.coords) {
    let geoPromise = fetchJson(
      `${GEO_REQ}${position.coords.latitude},${position.coords.longitude}`,
      'Error while reversing geocode.'
    );

    return geoPromise.then(
      (result) => {
        if (result && result.status && result.status === 'OK') {
          return result;
        } else if (result && result.status) {
          throw new GeoError('Reverse', null,
            `Reversing geocode failed with status "${result.status}."`);
        } else {
          throw new GeoError('Reverse', null, 'Reversing geocode failed.');
        }
      }
    );
  }

  throw new Error('No position data for reversing geocode.');
}
