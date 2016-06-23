2.1.0
==================
 * Render stream emits "log" event with data from onError, onConsoleMessage, onRequestError and onRequestTimeout webpage hooks.


2.0.0
==================

 * Switched to PhantomJS 2: replaced the (now deprecated) `phantomjs` dependency
   with `phantomjs-prebuilt` which installs PhantomJS 2.
 * When '--debug=true' is used as a phantomFlag and
   'DEBUG=phantom-render-stream' is set in the environment,
   STDERR of the Phantom process is now piped to the parent process STDERR
   and labeled as `stderr` so that you can tell it apart from `stdout`. (Mark Stosberg)

####Breaking changes
   There might be some issue with zooming because of phantomjs 2+

1.7.1
==================

1.7.0
==================

1.6.0 / 2015-01-29
==================

 * Provide complete request details when rendering fails. (Mark Stosberg)
 * Bug fix: "Render failed" no longer fails due to hardcoded internal timeout
   value when rendering takes longer than 10 seconds and 'timeout' value is
   set sufficiently high (#43, fixed by Mark Stosberg)

1.5.0 / 2015-01-28
==================

 * New quality option for specifying JPEG image quality. Defaults to 100.

1.4.0 / 2014-11-21
==================

 * Added support for passing cookies.
 * Added support for injecting polyfills.

1.3.0 / 2014-10-21
==================

 * Added support for headers option when rendering a page.
 * Documented how to use `render` as a transform stream.

1.2.0 / 2014-10-09
==================

 * `render` now returns a duplex stream

1.1.0 / 2014-09-23
==================

 * `paperSize` can now be set manually.

1.0.4 / 2014-09-02
==================

 * fontconfig depenendency is now documented in README.
 * `maxRenders` default was updated to be 500

1.0.3 / 2014-08-14
==================

 * `maxRenders` default was updated to be 1000

1.0.2 / 2014-08-14
==================

  * 'retries' option is now documented (Mark Stosberg)
  * Add "Troubleshooting" and "See Also" sections to README.md (Mark Stosberg)
  * Add HISTORY.md file (Mark Stosberg)
  * default value of 'tmp' is now documented (Mark Stosberg)
  * `maxErrors` option is documented. The option is used to limit how many phantom process errors
     are tolerated befor the process is killed.
  * `maxRenders` option is addeded. It is the number of options that a phantom process can make before
     it will be restarted. Defaults to 20.

1.0.1 / 2014-06-19
==================

  * Fix issue with timeouts hanging the tests

1.0.0 / 2014-06-19
==================

  * Fixed timeout related issue


0.8.8 / 2014-06-19
==================

  * Both 'debug' and 'debug-stream' modules are now in use.
  * Refactored how options are passed
  * Kill phantom after 3 errors. New `maxErrors` option is added, but not yet documented.

0.8.7 / 2014-06-19
==================

  * Forward printMedia option to phantomProcess

0.8.6 / 2014-06-18
==================

  * Do not parse JSON strictly.

0.8.5 / 2014-06-18
==================

  * Bump ldjson-stream version requirement
  * Added support for passing command line options to phanton (Mark Stosberg, Ben Dalton)

0.8.4 / 2014-06-17
==================

  * Changed debug code

0.8.3 / 2014-06-17
==================

  * Refactored debug code

0.8.2 / 2014-06-17
==================

  * Lose debug option and use debug-stream instead

0.8.1 / 2014-06-17
=================

  * Add debug option

0.8.0 / 2014-06-16
=================

  * Major rewrite. `mkfifo` is no longer used. It had proved problematic.
  * More options docs
  * tmp dir fixes
  * converted tabs to spaces
  * fixes for 'expects', more tests
  * Fix clean-up function
  * Fix timeout function

0.7.0 / 2014-06-11
=================

  * Added crop margin top crop margin left options (AndrewGrachov)

0.6.0 / 2014-06-11
=================

  * Initial hacky Windows support
  * Added missing dependencies

0.5.0 and earlier
===================

  * No formal documented history. See Github commits.
