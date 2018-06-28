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
import path from 'path';
import cssnano from 'cssnano';
import atImport from 'postcss-import';
import cssnext from 'postcss-cssnext';

import gulp from 'gulp';
import shell from 'gulp-shell';
import replace from 'gulp-replace';
import htmlmin from 'gulp-htmlmin';
import rev from 'gulp-rev';
import revReplace from 'gulp-rev-replace';
import postcss from 'gulp-postcss';
import concat from 'gulp-concat';

import webpack from 'webpack';
import MinifyPlugin from 'babel-minify-webpack-plugin';

const DATA = ['data/*.json'];
const CRITICAL_STYLES = ['styles/critical/main.css'];
const STYLES = ['styles/*.css'];
const IMAGES = ['images/**/*.{svg,png}'];
const ROOT = ['*.{txt,ico,go}', 'manifest.json', 'sw.js', 'app.yaml'];
const HTML = ['index.html'];
const WELL_KNOWN = ['well_known/**.*'];

const BROWSERS = [
  'last 2 Chrome versions',
  'last 2 Firefox versions',
  'last 2 Safari versions',
  '> 1%',
  'not last 2 OperaMini versions',
];
const CSS_AT_IMPORT = [atImport()];
const CSS_NEXT = [
  cssnext({
    browsers: BROWSERS,
    features: {
      customProperties: {
        preserve: true,
        warnings: false,
      },
      colorFunction: false,
    },
  }),
];
const CSS_NANO = [
  cssnano({
    autoprefixer: false,
    browsers: BROWSERS,
    zindex: false,
    discardComments: {
      removeAll: true,
    },
  }),
];

const REV_MANIFEST = '.temp/rev-manifest.json';

gulp.task('clean', () => del(['.temp', 'dist']));

gulp.task('critical-styles', () =>
  gulp
  .src(CRITICAL_STYLES)
  .pipe(postcss(CSS_AT_IMPORT))
  .pipe(concat('critical.css'))
  .pipe(postcss(CSS_NEXT))
  .pipe(gulp.dest('.temp/styles'))
);

gulp.task('critical-styles-min', () =>
  gulp
  .src('.temp/styles/critical.css')
  .pipe(concat('critical.min.css'))
  .pipe(postcss(CSS_NANO))
  .pipe(gulp.dest('.temp/styles'))
);

gulp.task('noncritical-styles', () => {
  let processedCritical = fs.readFileSync('.temp/styles/critical.css', 'utf8');
  return (
    gulp
    .src(CRITICAL_STYLES.concat(STYLES))
    .pipe(postcss(CSS_AT_IMPORT))
    .pipe(concat('styles.css'))
    .pipe(postcss(CSS_NEXT))
    // Remove all critical styles from the generated file.
    // This allows us to maintain our build pipeline and use information in
    // the critical styles without repeating it in the lazy-loaded ones.
    // Assumes that the pipeline produces deterministic and incremental code.
    .pipe(replace(processedCritical, ''))
    .pipe(gulp.dest('.temp/styles'))
  );
});

gulp.task('noncritical-styles-min', () =>
  gulp
  .src('.temp/styles/styles.css')
  .pipe(concat('styles.min.css'))
  .pipe(postcss(CSS_NANO))
  .pipe(gulp.dest('.temp/styles'))
);

gulp.task('styles-rev', () =>
  gulp
  .src('.temp/styles/styles.min.css')
  .pipe(rev())
  .pipe(gulp.dest('dist/styles'))
  .pipe(
    rev.manifest(REV_MANIFEST, {
      base: '.temp',
      merge: true,
    })
  )
  .pipe(gulp.dest('.temp'))
);

gulp.task(
  'styles',
  gulp.series(
    'critical-styles',
    gulp.parallel(
      'critical-styles-min',
      gulp.series('noncritical-styles', 'noncritical-styles-min', 'styles-rev')
    )
  )
);

gulp.task('webpack', (callback) => {
  // Run WebPack.
  webpack(
    [{
      entry: {
        main: './scripts/main.js',
      },
      module: {
        rules: [{
          test: /\.js$/,
          use: {
            loader: 'babel-loader',
            options: {
              shouldPrintComment: () => false,
              compact: true,
              presets: [
                [
                  'env',
                  {
                    targets: {
                      browsers: BROWSERS,
                    },
                    modules: false,
                  },
                ],
              ],
              plugins: ['syntax-dynamic-import'],
            },
          },
        }],
      },
      plugins: [
        new MinifyPlugin({
          simplify: false,
          mangle: false,
        }),
      ],
      output: {
        filename: 'scripts/[name].js',
        chunkFilename: 'scripts/views/view-[name].js',
        path: path.resolve(__dirname, '.temp/'),
      },
    }],
    (err, stats) => {
      if (err) {
        console.error(err.stack || err);
        if (err.details) {
          console.error(err.details);
        }
        return;
      }

      const info = stats.toJson();

      if (stats.hasErrors()) {
        info.errors.map((error) => console.error(error));
      }

      if (stats.hasWarnings()) {
        info.warnings.map((error) => console.warn(error));
      }
      callback();
    }
  );
});

gulp.task(
  'scripts',
  gulp.series('webpack', () =>
    gulp.src('.temp/scripts/views/**/*').pipe(gulp.dest('dist/scripts/views'))
  )
);

gulp.task('data', () =>
  gulp
  .src(DATA)
  .pipe(rev())
  .pipe(gulp.dest('dist/data'))
  .pipe(
    rev.manifest(REV_MANIFEST, {
      base: '.temp',
      merge: true,
    })
  )
  .pipe(gulp.dest('.temp'))
);

gulp.task('images', () =>
  gulp
  .src(IMAGES)
  .pipe(rev())
  .pipe(gulp.dest('dist/images/'))
  .pipe(
    rev.manifest(REV_MANIFEST, {
      base: '.temp',
      merge: true,
    })
  )
  .pipe(gulp.dest('.temp'))
);

gulp.task('root', () =>
  gulp
  .src(ROOT)
  // Replace links with revisioned URLs.
  .pipe(
    revReplace({
      replaceInExtensions: ['.js', '.yaml', '.json', '.txt', '.html'],
      manifest: gulp.src(REV_MANIFEST),
    })
  )
  .pipe(gulp.dest('dist/'))
);

gulp.task('html', () =>
  gulp
  .src(HTML)
  // Inline critical path CSS.
  .pipe(
    replace('<!-- {% include critical css %} -->', (s) => {
      let style = fs.readFileSync('.temp/styles/critical.min.css', 'utf8');
      return '<style>\n' + style + '\n</style>';
    })
  )
  // Inline main JS.
  .pipe(
    replace('<!-- {% include main js %} -->', (s) => {
      let script = fs.readFileSync('.temp/scripts/main.js', 'utf8');
      return '<script>\n' + script + '\n</script>';
    })
  )
  // Replace links with revisioned URLs.
  .pipe(
    revReplace({
      manifest: gulp.src(REV_MANIFEST),
    })
  )
  // Minify HTML.
  .pipe(
    htmlmin({
      collapseWhitespace: true,
      removeComments: true,
    })
  )
  .pipe(gulp.dest('dist/'))
);

gulp.task('wellknown', () =>
  gulp.src(WELL_KNOWN).pipe(gulp.dest('dist/well-known/'))
);

gulp.task('build',
  gulp.series('clean',
    gulp.parallel('styles', 'scripts', 'data', 'images', 'wellknown'),
    gulp.parallel('root', 'html')));

gulp.task('deploy', gulp.series('build', () =>
  gulp.src('dist').pipe(
    shell(
      'gcloud app deploy --no-promote --project material-money --version v3', {
        cwd: 'dist',
      }
    )
  )
));

gulp.task('serve', gulp.series('build', () =>
  gulp.src('dist').pipe(
    shell('dev_appserver.py app.yaml', {
      cwd: 'dist',
    })
  )
));
