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

import fs from 'fs';
import del from 'del';
import cssnano from 'cssnano';
import atImport from 'postcss-import';
import cssnext from 'postcss-cssnext';

import gulp from 'gulp';
import shell from 'gulp-shell';
import replace from 'gulp-replace';
import runSequence from 'run-sequence';
import htmlmin from 'gulp-htmlmin';
import rev from 'gulp-rev';
import revReplace from 'gulp-rev-replace';
import postcss from 'gulp-postcss';
import sourcemaps from 'gulp-sourcemaps';
import concat from 'gulp-concat';
import rollup from 'gulp-better-rollup';

import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

const DATA = ['data/*.json'];
const MAIN_SCRIPT = ['scripts/main.js'];
const VIEWS = ['scripts/views/*.js'];
const CRITICAL_STYLES = ['styles/critical/main.css'];
const STYLES = ['styles/*.css'];
const IMAGES = ['images/**/*.{svg,png}'];
const ROOT = ['*.{txt,ico,go}', 'manifest.json', 'sw.js', 'app.yaml'];
const HTML = ['index.html'];

const BROWSERS = ['last 2 versions', 'not ie <= 11', 'not ie_mob <= 11'];
const CSS_AT_IMPORT = [atImport()];
const CSS_NEXT = [
  cssnext({browsers: BROWSERS, features: {
    customProperties: {preserve: true, warnings: false},
    colorFunction: false,
  }}),
];
const CSS_NANO = [
  cssnano({
    autoprefixer: false,
    browsers: BROWSERS,
    zindex: false,
    discardComments: {removeAll: true},
  }),
];

const REV_MANIFEST = '.temp/rev-manifest.json';

gulp.task('clean', () => {
  return del(['.temp', 'dist']);
});

gulp.task('critical-styles', () => {
  return gulp.src(CRITICAL_STYLES)
    .pipe(postcss(CSS_AT_IMPORT))
    .pipe(concat('critical.css'))
    .pipe(postcss(CSS_NEXT))
    .pipe(gulp.dest('.temp/styles'));
});

gulp.task('critical-styles-min', ['critical-styles'], () => {
  return gulp.src('.temp/styles/critical.css')
    .pipe(concat('critical.min.css'))
    .pipe(postcss(CSS_NANO))
    .pipe(gulp.dest('.temp/styles'));
});

gulp.task('styles', ['critical-styles-min'], () => {
  let processedCritical =
      fs.readFileSync('.temp/styles/critical.css', 'utf8');
  return gulp.src(CRITICAL_STYLES.concat(STYLES))
    .pipe(postcss(CSS_AT_IMPORT))
    .pipe(concat('styles.css'))
    .pipe(postcss(CSS_NEXT))
    // Remove all critical styles from the generated file.
    // This allows us to maintain our build pipeline and use information in the
    // critical styles without repeating it in the lazy-loaded ones.
    // Assumes that the pipeline produces deterministic and incremental code.
    .pipe(replace(processedCritical, ''))
    .pipe(gulp.dest('.temp/styles'));
});

gulp.task('styles-min', ['styles'], () => {
  return gulp.src('.temp/styles/styles.css')
    .pipe(concat('styles.min.css'))
    .pipe(postcss(CSS_NANO))
    .pipe(gulp.dest('dist/styles'));
});

gulp.task('main-script', () => {
  return gulp.src(MAIN_SCRIPT)
    .pipe(rollup({
      plugins: [
        babel({
          babelrc: false,
          plugins: ['external-helpers'],
          presets: [
            ['env', {
              targets: {
                browsers: BROWSERS,
              },
              modules: false,
            }],
            ['babili'],
          ],
        }),
        nodeResolve({main: true}),
        commonjs({
          namedExports: {
            'node_modules/webfontloader/webfontloader.js': ['WebFont'],
          },
        }),
      ],
    }, 'iife'))
    .pipe(gulp.dest('.temp/scripts'));
});

gulp.task('views', ['main-script'], () => {
  return gulp.src(VIEWS)
    .pipe(sourcemaps.init())
    .pipe(rollup({
      plugins: [
        babel({
          babelrc: false,
          presets: [
            ['env', {
              targets: {
                browsers: BROWSERS,
              },
              modules: false,
            }],
            ['babili'],
          ],
        }),
        nodeResolve({main: true}),
      ],
    }, {
      format: 'iife',
      moduleName: 'Views',
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist/scripts/views'));
});

gulp.task('data', () => {
  return gulp.src(DATA)
    .pipe(rev())
    .pipe(gulp.dest('dist/data'))
    .pipe(rev.manifest(REV_MANIFEST, {
      base: '.temp',
      merge: true,
    }))
    .pipe(gulp.dest('.temp'));
});

gulp.task('images', () => {
  return gulp.src(IMAGES)
    .pipe(rev())
    .pipe(gulp.dest('dist/images/'))
    .pipe(rev.manifest(REV_MANIFEST, {
      base: '.temp',
      merge: true,
    }))
    .pipe(gulp.dest('.temp'));
});

gulp.task('root', () => {
  return gulp.src(ROOT)
    // Replace links with revisioned URLs.
    .pipe(revReplace({
      replaceInExtensions: ['.js', '.yaml', '.json', '.txt'],
      manifest: gulp.src(REV_MANIFEST),
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('html', () => {
  return gulp.src(HTML)
    // Inline critical path CSS.
    .pipe(replace('<!-- {% include critical css %} -->', (s) => {
      let style = fs.readFileSync('.temp/styles/critical.min.css', 'utf8');
      return '<style>\n' + style + '\n</style>';
    }))
    // Inline main JS.
    .pipe(replace('<!-- {% include main js %} -->', (s) => {
      let script = fs.readFileSync('.temp/scripts/main.js', 'utf8');
      return '<script>\n' + script + '\n</script>';
    }))
    // Replace links with revisioned URLs.
    .pipe(revReplace({
      manifest: gulp.src(REV_MANIFEST),
    }))
    // Minify HTML.
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('build', (callback) => {
  runSequence(
    'clean',
    ['styles-min', 'views', 'data', 'images'],
    ['root', 'html'],
    callback
  );
});

gulp.task('deploy', ['build'], () => {
  return gulp.src('dist')
    .pipe(shell('goapp deploy -application material-money -version v2',
        {cwd: 'dist'}
  ));
});

gulp.task('serve', ['build'], () => {
  return gulp.src('dist')
    .pipe(shell('goapp serve',
        {cwd: 'dist'}
  ));
});
