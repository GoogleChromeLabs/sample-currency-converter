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
 * Format a number into a pixel size string.
 * @param {number} number The number to format.
 * @return {string} The formatted pixel size string.
 */
function _pixels(number) {
  return `${number}px`;
}

/**
 * Helper class to perform animations.
 */
export default class AnimationHelper {
  /**
   * Create an AnimationHelper object.
   * @param {Element} animationScreen The specially-crafted screen where the
   *                                  elements being animated exist.
   */
  constructor(animationScreen) {
    this._animationScreen = animationScreen;
    this._clip =
        this._animationScreen.querySelector(`.${AnimationHelper.CSS.CLIP}`);
    this._item =
        this._animationScreen.querySelector(`.${AnimationHelper.CSS.ITEM}`);
  }

  /**
   * CSS class names used in the AnimationHelper.
   */
  static get CSS() {
    return {
      SCREEN: {
        DISABLED: 'mm-screen--disabled',
        INVISIBLE: 'mm-screen--hidden',
        UNDER: 'mm-screen--under',
      },
      ANIMATION: {
        VISIBLE: 'mm-animation--visible',
        ANIMATING: 'mm-animation--animating',
      },
      CLIP: 'mm-animation__clip',
      ITEM: 'mm-animation__item',
      RULER: 'mm-animation__ruler',
      CIRCLE: 'mm-animation--circle',
    };
  }

  /**
   * Clear all styles that we might have set for the animation.
   */
  removeStyles() {
    ['top', 'left', 'height', 'width', 'border-radius', 'transform',
     'background'].forEach(
      (property) => {
        this._animationScreen.style.removeProperty(property);
        this._clip.style.removeProperty(property);
        this._item.style.removeProperty(property);
      }
    );
  }

  /**
   * Fades start screen to end screen.
   * @param {Element} startScreen The screen to fade from.
   * @param {Element} targetScreen The screen to fade to.
   */
  fadingAnimation(startScreen, targetScreen) {
    // Display end screen underneath the start and animation screens.
    targetScreen.classList.add(AnimationHelper.CSS.SCREEN.UNDER);
    targetScreen.classList.remove(AnimationHelper.CSS.SCREEN.DISABLED);

    // Display animation screen to capture click events.
    this._animationScreen.style.setProperty('background', 'transparent');
    this._animationScreen.classList.add(AnimationHelper.CSS.ANIMATION.VISIBLE);

    const cleanupHandler = () => {
      startScreen.classList.add(AnimationHelper.CSS.SCREEN.DISABLED);
      startScreen.classList.remove(AnimationHelper.CSS.SCREEN.INVISIBLE);
      targetScreen.classList.remove(AnimationHelper.CSS.SCREEN.UNDER);

      // Hide animation screen again.
      this._animationScreen.classList.remove(
          AnimationHelper.CSS.ANIMATION.VISIBLE);
      this.removeStyles();
      startScreen.removeEventListener('transitionend', cleanupHandler);
    };

    startScreen.classList.add(AnimationHelper.CSS.SCREEN.INVISIBLE);

    // Trigger cleanup when fade ends.
    startScreen.addEventListener('transitionend', cleanupHandler);
  }

  /**
   * Perform an animation that appears to scale an element in one screen to an
   * element in another screen.
   * Uses a specially-crafted animation layer to achieve this effect.
   *
   * @param {Element} startEl The element to transform from.
   * @param {Element} targetEl The element to transform to.
   *                           Uses the whole screen if null.
   * @param {Element} startScreen The screen where the start element lives.
   * @param {Element} targetScreen The screen where the target element lives.
   * @param {boolean} transparentBg Whether to use a transparent background in
   *                                the animation screen.
   * @param {boolean} fadeStartScreen Whether to fade the start screen out.
   * @param {boolean} hideTarget Whether to hide the end element until the end
   *                             of the animation.
   */
  scalingAnimation(
      {startEl, targetEl, startScreen, targetScreen,
       transparentBg = false, fadeStartScreen = false, hideTarget = false}) {
    let startRect = startEl.getBoundingClientRect();
    const startStyle = getComputedStyle(startEl);
    let endRect = null;
    let endStyle = null;

    const offset = startScreen.getBoundingClientRect().left;

    // Save scroll position before we start.
    const scrollTop = document.body.scrollTop;

    // Handle transparent background option.
    if (transparentBg) {
      this._animationScreen.style.setProperty('background', 'transparent');
    }

    if (targetEl) {
      // Enable target screen for measurement.
      targetScreen.classList.remove(AnimationHelper.CSS.SCREEN.DISABLED);
      // Set it to position fixed to make sure we're reading the pixels at the
      // right location.
      targetScreen.style.setProperty('position', 'fixed');

      // Measure it.
      endRect = targetEl.getBoundingClientRect();
      endStyle = getComputedStyle(targetEl);

      // Hide it again and reset position.
      targetScreen.classList.add(AnimationHelper.CSS.SCREEN.DISABLED);
      targetScreen.style.removeProperty('position');
    } else {
      // Transition to viewport box if no target element is provided.
      let ruler =
          this._animationScreen.querySelector(`.${AnimationHelper.CSS.RULER}`);
      endRect = ruler.getBoundingClientRect();
      endStyle = getComputedStyle(ruler);
    }

    let clipTop = 0;
    let clipLeft = 0;
    let scaleX = endRect.width / startRect.width;
    let scaleY = endRect.height / startRect.height;

    // Copy start element background to the animating element.
    if (startStyle.getPropertyValue('background')) {
      this._item.style.setProperty('background',
          startStyle.getPropertyValue('background'));
    } else {
      this._item.style.setProperty('background-color',
          startStyle.getPropertyValue('background-color'));
    }

    // Firefox doesn't generate shorthand properties in computed styles, so we
    // need to generate these ourselves.
    let startRadius =
        startStyle.getPropertyValue('border-top-left-radius') + ' ' +
        startStyle.getPropertyValue('border-top-right-radius') + ' ' +
        startStyle.getPropertyValue('border-bottom-right-radius') + ' ' +
        startStyle.getPropertyValue('border-bottom-left-radius');

    // Are we animating from a circle to a rectangle?
    let circleToRect = startEl.classList.contains(AnimationHelper.CSS.CIRCLE) &&
        (!targetEl || !targetEl.classList.contains(AnimationHelper.CSS.CIRCLE));
    if (circleToRect) {
      // Animate a circle growing into a rectangle.
      // Position the clipping element so that the animating element, at its
      // center, starts in the right place.
      clipTop = startRect.top - endRect.height / 2 + startRect.height / 2;
      clipLeft = startRect.left - offset - endRect.width / 2 +
          startRect.width / 2;
      this._clip.style.setProperty('top', _pixels(clipTop));
      this._clip.style.setProperty('left', _pixels(clipLeft));

      // The circle should overflow the clipping rectangle to completely fill
      // it.
      scaleX = Math.hypot(endRect.height, endRect.width) / startRect.width;
      scaleY = scaleX;

      // Set clipping element height, width and shape to those of target.
      this._clip.style.setProperty('height', _pixels(endRect.height));
      this._clip.style.setProperty('width', _pixels(endRect.width));
      this._clip.style.setProperty('border-radius',
          endStyle.getPropertyValue('border-radius'));

      // Position the animating element at the center of the clipping element.
      this._item.style.setProperty('top',
          _pixels(endRect.height / 2 - startRect.height / 2));
      this._item.style.setProperty('left',
          _pixels(endRect.width / 2 - startRect.width / 2));
    } else {
      // Animate other cases.
      // Make the clipping element span the whole screen.
      this._clip.style.setProperty('top', '0');
      this._clip.style.setProperty('left', '0');
      this._clip.style.setProperty('height', '100vh');
      this._clip.style.setProperty('width', '100vw');

      // Position the animating element on top of the starting element.
      this._item.style.setProperty('top', _pixels(startRect.top));
      this._item.style.setProperty('left', _pixels(startRect.left - offset));
    }

    // Adjust position and shape of animating element.
    this._item.style.height = startRect.height + 'px';
    this._item.style.width = startRect.width + 'px';
    this._item.style.setProperty('border-radius', startRadius);

    // Keep track of which stage of our animation we are currently at.
    let stage = 1;

    const animationHandler = (target) => {
      if (stage === 2) {
        // Stage 2: scale and move.
        if (circleToRect) {
          // Move the clipping element to its final position.
          let x = endRect.left - clipLeft;
          let y = endRect.top - clipTop;
          this._clip.style.setProperty('transform',
              `translate(${x}px, ${y}px)`);

          // Scale the animating element to its final size.
          this._item.style.setProperty('transform', `scale(${scaleX})`);
        } else {
          // Move and scale the animating element. The clipping element stays
          // in place.
          let x = (endRect.left + endRect.width / 2) -
              (startRect.left + startRect.width / 2);
          let y = (endRect.top + endRect.height / 2) -
              (startRect.top + startRect.height / 2);
          this._item.style.setProperty('transform',
              `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`);
        }
      } else if (stage === 3) {
        if (hideTarget && targetEl) {
          // If we were hiding the target element, fade it in now.
          targetEl.style.removeProperty('opacity');
        }

        // Stage 3: fade to end screen.
        // Remove start screen and make target screen display permanent.
        startScreen.classList.add(AnimationHelper.CSS.SCREEN.DISABLED);
        startScreen.classList.remove(AnimationHelper.CSS.SCREEN.INVISIBLE);
        targetScreen.classList.remove(AnimationHelper.CSS.SCREEN.UNDER);

        // Fade the animation layer out.
        this._animationScreen.classList.remove(
            AnimationHelper.CSS.ANIMATION.VISIBLE);
      } else if (stage >= 4 && target.propertyName === 'opacity') {
        // Stage 4: cleanup.
        this.removeStyles();

        // Remove animation layer.
        this._animationScreen.classList.remove(
            AnimationHelper.CSS.ANIMATION.ANIMATING);
        this._animationScreen.removeEventListener('transitionend',
            animationHandler);
      }
      stage++;
    };

    // Stage 1: trigger fade-in of animation layer.
    this._animationScreen.classList.add(
        AnimationHelper.CSS.ANIMATION.ANIMATING);
    this._animationScreen.classList.add(AnimationHelper.CSS.ANIMATION.VISIBLE);
    this._animationScreen.addEventListener('transitionend', animationHandler);

    // Wait until the transition property change is applied.
    requestAnimationFrame(() => {
      this._animationScreen.classList.add(
          AnimationHelper.CSS.ANIMATION.VISIBLE);
      // Wait until the opacity property change is applied.
      requestAnimationFrame(() => {
        document.body.scrollTop = scrollTop;
        // Display end screen underneath the start and animation screens.
        targetScreen.classList.add(AnimationHelper.CSS.SCREEN.UNDER);
        targetScreen.classList.remove(AnimationHelper.CSS.SCREEN.DISABLED);

        if (fadeStartScreen) {
          // Fade start screen out, if that option is enabled.
          startScreen.classList.add(AnimationHelper.CSS.SCREEN.INVISIBLE);
        }

        if (hideTarget && targetEl) {
          // Hide the target element, if that option is enabled.
          targetEl.style.setProperty('opacity', '0');
        }

        // Trigger stage 2.
        stage++;
      });
    });
  }
}
