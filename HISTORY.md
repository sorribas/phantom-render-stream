
  * Add "Troubleshooting" and "See Also" sections to README.md (Mark Stosberg)
  * Add HISTORY.md file (Mark Stosberg)
  * default value of 'tmp' is now documented (Mark Stosberg)
  * `maxErrors` option is documented. The option is used to limit how many phantom process errors
     are tolerated befor the process is killed.

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




