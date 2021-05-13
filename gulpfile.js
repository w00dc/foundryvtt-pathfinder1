// Build dependencies
const gulp = require("gulp");
const less = require("gulp-less");
const git = require("gulp-git");
const tagVersion = require("gulp-tag-version");
const replace = require("gulp-replace");
const sourcemaps = require("gulp-sourcemaps");
const del = require("del");
const rollupStream = require("@rollup/stream");
const nodeResolve = require("@rollup/plugin-node-resolve").nodeResolve;
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const changed = require("gulp-changed");
const { exec } = require("child_process");

// Dependencies for compendium tasks.
const Datastore = require("nedb");
const mergeStream = require("merge-stream");
const fs = require("fs");
const path = require("path");
const { Transform } = require("stream");

/* ----------------------------------------- */
/*  Constants
/* ----------------------------------------- */

// If bundling into a single output file is involved, the first element
// is considered the entry point
const SYSTEM_LESS = ["less/pf1.less", "less/**/*.less"];
const SYSTEM_MODULES = ["pf1.js", "module/**/*.js"];
const SYSTEM_FILES = [
  "lang/**/*",
  "templates/**/*",
  "fonts/**/*",
  "icons/**/*",
  "template.json",
  "system.json",
  "ui/**/*",
  "help/**/*",
  "CHANGELOG.md",
  "LICENSE.txt",
  "OGL.txt",
  "CREDITS.md",
];
const DESTINATION = "dist";
const PACK_SRC = "packs";
const PACK_DEST = path.join(DESTINATION, "packs");
const IS_WIN = process.platform === "win32";

/* ----------------------------------------- */
/*  Build steps
/* ----------------------------------------- */

/**
 * Compiles less files into CSS
 */
function compileLESS() {
  return gulp
    .src(SYSTEM_LESS[0])
    .pipe(sourcemaps.init())
    .pipe(less())
    .pipe(
      sourcemaps.mapSources((sourcePath, _) => {
        // Correct all paths to mirror actual file structure
        return "less/" + sourcePath;
      })
    )
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(DESTINATION));
}

/* ----------------------------------------- */
/*  Compile JS
/* ----------------------------------------- */
/**
 * The rollup cache to improve speed when watching files
 *
 * @type {object}
 */
let cache;
/**
 * Bundles JS modules into one file
 */
function rollup() {
  return rollupStream({
    input: SYSTEM_MODULES[0],
    output: {
      format: "es",
      exports: "named",
      sourcemap: true,
      preferConst: true,
    },
    cache: cache,
    plugins: [nodeResolve({ preferBuiltins: false }), commonjs(), json()],
  })
    .on("bundle", (bundle) => {
      cache = bundle;
    })
    .pipe(source(SYSTEM_MODULES[0]))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest(DESTINATION));
}

/**
 * Copies all regular files to the destination dir
 * In watch mode, only changed files will get copied.
 */
function copyFiles() {
  if (IS_WIN) {
    let promises = [],
      args = "/R:5 /W:15 /MT:32 /NFL /NDL /NJH /NJS /nc /ns /np";
    SYSTEM_FILES.forEach((sf) => {
      promises.push(
        new Promise((resolve) => {
          if (sf.indexOf("**") > -1) {
            let folder = sf.replace("/**/*", "");
            exec(`robocopy ${folder} ${DESTINATION}/${folder} /mir ${args}`, null, resolve);
          } else exec(`robocopy . ${DESTINATION} ${sf} ${args}`, null, resolve);
        })
      );
    });
    return Promise.all(promises);
  }
  return gulp.src(SYSTEM_FILES, { base: "." }).pipe(changed(DESTINATION)).pipe(gulp.dest(DESTINATION));
}

/**
 * Deletes all files in the destination directory
 */
function deleteFiles() {
  return del(`${DESTINATION}/*`, { force: true });
}

/**
 * Watches for updates to less, js, and system files
 */
function watchUpdates() {
  gulp.watch(SYSTEM_LESS, compileLESS);
  gulp.watch(SYSTEM_FILES, copyFiles);
  gulp.watch(SYSTEM_MODULES, rollup);
}

/* ----------------------------------------- */
/*  Version management
/* ----------------------------------------- */

/**
 * Gets the current system version
 *
 * @returns {string} The current version
 */
function getTagVersion() {
  try {
    const file = fs.readFileSync("./system.json", "utf-8");
    const data = JSON.parse(file);
    return data.version;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Increments the system's version and writes manifest
 *
 * @param {string} importance - The step by which the version should be increased
 */
function inc(importance) {
  const version = getTagVersion();
  if (version) {
    const oldVersion = version;
    let newVersion = version.split(".");
    switch (importance) {
      case "patch":
        newVersion[2]++;
        break;
      case "minor":
        newVersion[2] = 0;
        newVersion[1]++;
        break;
      case "major":
        newVersion[2] = 0;
        newVersion[1] = 0;
        newVersion[0]++;
        break;

      default:
        break;
    }
    newVersion = newVersion.join(".");
    return (
      gulp
        .src(["./system.json"])
        .pipe(replace(oldVersion, newVersion))
        // .pipe(replace("jobs/artifacts/master", `jobs/artifacts/${newVersion}`))
        .pipe(gulp.dest("."))
    );
  } else {
    return gulp.src(["./system.json"]);
  }
}

/**
 * Commits current changes and creates a new tag
 */
function commitTag() {
  const version = getTagVersion();
  if (version) {
    return gulp
      .src(["./system.json"])
      .pipe(git.commit(`Release ${version}`))
      .pipe(tagVersion({ prefix: "" }));
  } else {
    return gulp.src(["./system.json"]);
  }
}
/**
 * Bumping version number and tagging the repository with it.
 * Please read http://semver.org/
 *
 * You can use the commands
 *
 *     gulp patch     # makes v0.1.0 → v0.1.1
 *     gulp feature   # makes v0.1.1 → v0.2.0
 *     gulp release   # makes v0.2.1 → v1.0.0
 *
 * To bump the version numbers accordingly after you did a patch,
 * introduced a feature or made a backwards-incompatible release.
 */
const patch = function () {
  return inc("patch");
};
const major = function () {
  return inc("major");
};
const minor = function () {
  return inc("minor");
};

/* ----------------------------------------- */
/*  Pack management
/* ----------------------------------------- */

/**
 * Sluggify a string.
 *
 * This function will take a given string and strip it of non-machine-safe
 * characters, so that it contains only lowercase alphanumeric characters and
 * hyphens.
 *
 * @param {string} string String to sluggify.
 * @returns {string} The sluggified string
 */
function sluggify(string) {
  return string
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+|-{2,}/g, "-");
}

/**
 * Santize pack entries.
 *
 * This resets the entries' permissions to defaul and removes all non-pf1 flags.
 *
 * @param {object} pack Loaded compendium content.
 * @returns {object} The sanitized content.
 */
function sanitizePack(pack) {
  // Reset permissions to default
  pack.permission = { default: 0 };
  // Remove non-system/non-core flags
  for (const key of Object.keys(pack.flags)) {
    if (key !== "pf1") delete pack.flags[key];
  }
  return pack;
}

/**
 * Extract pack entries from DBs and into single files
 *
 * @returns {NodeJS.ReadableStream} The merged ReadableStream
 */
function extractPacks() {
  const extract = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(file, _, callback) {
      // Create directory.
      let filename = path.parse(file.path).name;
      if (!fs.existsSync(`./${PACK_SRC}/${filename}`)) {
        fs.mkdirSync(`./${PACK_SRC}/${filename}`);
      }

      // Load the database.
      const db = new Datastore({ filename: file.path, autoload: true });
      db.loadDatabase();

      // @TODO: Evaluate if this check actually does anything
      db.persistence.compactDatafile();
      db.on("compaction.done", () => {
        // Export the packs.
        db.find({}, (_, packs) => {
          // Iterate through each compendium entry.
          packs.forEach((pack) => {
            // Remove permissions and _id
            pack = sanitizePack(pack);

            let output = JSON.stringify(pack, null, 2);

            // Sluggify the filename.
            let packName = sluggify(pack.name);

            // Write to the file system.
            fs.writeFileSync(path.resolve(__dirname, PACK_SRC, filename, `${packName}.json`), output);
          });
        });
      });

      // Complete the callback.
      callback(null, file);
    },
  });

  // Start a stream for all db files in the packs dir.
  const packs = gulp
    .src(`${PACK_DEST}/**/*.db`)
    // Run a callback on each pack file to load it and then write its
    // contents to the pack src dir.
    .pipe(extract);

  // Merge the streams.
  return mergeStream.call(null, packs);
}

/**
 * Compiles all json files into db packs
 *
 * @returns {NodeJS.ReadableStream} The pack name stream
 */
function compilePacks() {
  // Every folder in the src dir will become a compendium.
  const folders = fs.readdirSync(PACK_SRC).filter((file) => {
    return fs.statSync(path.join(PACK_SRC, file)).isDirectory();
  });

  // Iterate over each folder/compendium.
  const packs = folders.map((folder) => {
    // Initialize a blank nedb database based on the directory name. The new
    // database will be stored in the dest directory as <foldername>.db
    const db = new Datastore({ filename: path.resolve(__dirname, PACK_DEST, `${folder}.db`), autoload: true });
    // Process the folder contents and insert them in the database.
    const compile = new Transform({
      readableObjectMode: true,
      writableObjectMode: true,
      transform(file, _, callback) {
        let json = JSON.parse(file.contents.toString());
        db.insert(json);

        // Complete the callback.
        callback(null, file);
      },
    });
    return gulp.src(path.join(PACK_SRC, folder, "/**/*.json")).pipe(compile);
  });

  // Merge the streams.
  return mergeStream.call(null, packs);
}

/**
 * Deletes all compiled packs
 */
function cleanPacks() {
  return del(`${PACK_DEST}/**/*.db`, { force: true });
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

const watchTask = gulp.series(
  deleteFiles,
  gulp.parallel(compileLESS, copyFiles, rollup, gulp.series(cleanPacks, compilePacks)),
  watchUpdates
);

const buildTask = gulp.series(
  deleteFiles,
  gulp.parallel(compileLESS, copyFiles, rollup, gulp.series(cleanPacks, compilePacks))
);

exports.default = watchTask;
exports.build = buildTask;
exports.watch = watchTask;

exports.copy = copyFiles;
exports.css = compileLESS;
exports.rollup = rollup;

exports.patch = gulp.series(patch, buildTask, commitTag);
exports.minor = gulp.series(minor, buildTask, commitTag);
exports.major = gulp.series(major, buildTask, commitTag);

exports.compilePacks = gulp.series(cleanPacks, compilePacks);
exports.extractPacks = extractPacks;
