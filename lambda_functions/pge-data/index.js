'use strict';
let https = require('https'),
    mysql = require('mysql');

exports.handler = function (event, context, callback) {

    switch (event.type) {
    case 'update':
        var options = {
            hostname: 'utilityapi.com',
            port: 443,
            path: '/api/services/<uid>/modify.json?update_data=true',
            method: 'POST',
            headers: {
                'Authorization': 'Token <utilityapi-token>'
            }
        };

        var req = https.request(options, (res) => {
            console.log('[%s]: %s', res.statusCode, options.hostname);
        });

        req.end();
        callback();
        break;
    case 'fetch':
        var connection = mysql.createConnection({
            host: 'localhost',
            user: 'user',
            password: 'password',
            database: 'database'
        });

        var last_updated = new Date();

        connection.connect();

        connection.query('SELECT * FROM solar_data.energy_data WHERE id = 1 LIMIT 1', function (error, results, fields) {
            if (error) throw error;

            last_updated = new Date(results[0].updated).toISOString();

            var options = {
                hostname: 'utilityapi.com',
                port: 443,
                path: '/api/services/<uid>/intervals.json?start=' + encodeURIComponent(last_updated),
                method: 'GET',
                headers: {
                    'Authorization': 'Token <utilityapi-token>'
                }
            };

            var req = https.request(options, (res) => {
                let body = '';

                console.log('[%s]: %s', res.statusCode, options.hostname);

                res.setEncoding('utf8');

                res.on('data', (d) => {
                    body += d;
                });

                res.on('end', () => {

                    if (res.headers['content-type'] === 'application/json') {
                        body = JSON.parse(body);
                        console.log('%s objects found, processing.', body.length);
                        for (let i = 0; i < body.length; i++) {
                            let date = Date.parse(body[i].interval_start);
                            if (new Date(body[i].interval_start).dst()) {
                                date -= 28800000;
                            }
                            else {
                                date -= 25200000;
                            }
                            let used_kwh = body[i].interval_kWh;
                            connection.query("INSERT INTO solar_data.energy_data (datetime, used_kwh) VALUES(?, ?) ON DUPLICATE KEY UPDATE used_kwh = ?", [date, used_kwh, used_kwh], function (err, results) {
                                if (err) throw err;
                            });
                        }
                        var updated = body[0] !== undefined ? new Date(body[0].updated).toISOString().slice(0, 19).replace('T', ' ') : last_updated;
                        connection.query("UPDATE `solar_data`.`energy_data` SET `updated`=? WHERE `id`='1'", [updated], function (err, results) {
                            if (err) throw err;
                            connection.end();
                        });
                    }
                });
            });

            req.end();
        });
        callback();
    }
};


Date.prototype.stdTimezoneOffset = function () {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.dst = function () {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
};
