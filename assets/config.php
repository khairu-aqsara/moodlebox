<?php  // Moodle configuration file

unset($CFG);
global $CFG;
$CFG = new stdClass();

$CFG->dbtype    = 'mysqli';        // 'pgsql', 'mariadb', 'mysqli', 'sqlsrv' or 'oci'
$CFG->dblibrary = 'native';        // 'native' only at the moment
$CFG->dbhost    = 'moodle-db';     // eg 'localhost' or 'db.isp.com' or IP
$CFG->dbname    = 'moodle';        // database name, eg moodle
$CFG->dbuser    = 'moodle';        // your database username
$CFG->dbpass    = 'moodle';        // your database password
$CFG->prefix    = 'mdl_';          // Prefix to use for all table names
$CFG->dboptions = array(
    'dbpersist' => false,       // Should persistent database connections be
                                // used? This can improve performance but may
                                // increase load on the database server.
    'dbsocket'  => false,       // Should connection via UNIX socket be used?
                                // If you set this to true you must specify the
                                // socket path in $CFG->dbhost.
    'dbport'    => 3306,        // The TCP/IP port to use when connecting
                                // to the database server.
    'dbcollation' => 'utf8mb4_unicode_ci', // MySQL has partial and full UTF-8
                                            // support. If you wish to use
                                            // partial UTF-8 (three bytes) then
                                            // set this option to 'utf8_unicode_ci',
                                            // otherwise set this option to
                                            // 'utf8mb4_unicode_ci' which uses
                                            // full UTF-8 support (four bytes).
    'fetchbuffersize' => 100000, // On MySQL, this sets the buffer size when reading
                                // from the database. This can improve performance
                                // but may increase memory usage.
    'connecttimeout' => 3600,   // Connection timeout in seconds (1 hour)
);

$CFG->wwwroot   = 'http://localhost:8080';
$CFG->dataroot  = '/var/www/moodledata';
$CFG->dirroot   = '/var/www/html'; // Moodle root directory (not public/)
$CFG->libdir    = '/var/www/html/lib'; // Moodle library directory
$CFG->admin     = 'admin';

// Moodle 5.1: Prevent wwwroot from ending in /public (this will cause errors)
// The web server DocumentRoot points to /public, but wwwroot should not include it
if (substr($CFG->wwwroot, -7) === '/public') {
    throw new Exception('$CFG->wwwroot must not end in /public');
}

$CFG->directorypermissions = 0777;

// Performance settings
$CFG->cachejs = true;
$CFG->cachetemplates = true;

require_once(__DIR__ . '/lib/setup.php'); // Do not edit
