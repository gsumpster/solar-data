'use strict';
let https = require('https'),
    querystring = require('querystring'),
    mysql = require('mysql');

exports.handler = function (event, context, callback) {
  var connection = mysql.createConnection({
      host: 'host',
      user: 'user',
      password: 'password',
      database: 'db'
  });

var last_updated = new Date();

connection.connect();

connection.query('SELECT * FROM solar_data.energy_data WHERE id = 1 LIMIT 1', function (error, results, fields) {
    if (error) throw error;

    last_updated = new Date(results[0].updated);
    last_updated = new Date(last_updated.setDate(last_updated.getDate() - 7)).toISOString().substr(0, 19);

    var auth_data = '{"username":"sunpower_user","password":"sunpower_pass","isPersistent":false}';
    var auth_options = {
        hostname: 'monitor.us.sunpower.com',
        port: 443,
        path: '/CustomerPortal/Auth/Auth.svc/Authenticate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(auth_data)
        }
    };

    var token;

    var auth_req = https.request(auth_options, function (res) {
        let body = '';

        console.log('[%s]: %s', res.statusCode, auth_options.hostname);
        // console.log(res);

        res.setEncoding('utf8');

        res.on('data', (d) => {
            body += d;
        });

        res.on('end', function () {
            if (res.headers['content-type'] === 'application/json; charset=utf-8') {
                body = JSON.parse(body);
                token = body.Payload.TokenID;

                var options = {
                    hostname: 'monitor.us.sunpower.com',
                    port: 443,
                    path: '/CustomerPortal/SystemInfo/SystemInfo.svc/getHourlyEnergyData?timestamp='+last_updated+'&tokenId=' + encodeURIComponent(token),
                    method: 'GET'
                };
                var req = https.request(options, function (res) {
                    let body = '';

                    console.log('[%s]: %s', res.statusCode, auth_options.hostname);

                    res.setEncoding('utf8');

                    res.on('data', (d) => {
                        body += d;
                    });

                    res.on('end', function () {
                        if (res.headers['content-type'] === 'application/json; charset=utf-8') {
                            body = JSON.parse(body);
                            var data = body.Payload.split('|');
                            for (let i = 0; i < data.length; i++) {
                                var entry = data[i].split(',');
                                var date = Date.parse(entry[0]);
                                var generated_kwh = entry[1];
                                connection.query("INSERT INTO solar_data.energy_data (datetime, generated_kwh) VALUES(?, ?) ON DUPLICATE KEY UPDATE generated_kwh = ?", [date, generated_kwh, generated_kwh], function (err, results) {
                                    if (err) throw err;
                                });
                            }
                        }
                        connection.end();
                    });
                });

                req.end();
            }

        });
    });

    auth_req.write(auth_data);
    auth_req.end();

});
callback();
};
