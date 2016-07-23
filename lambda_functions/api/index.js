'use strict';
let https = require('https'),
    mysql = require('mysql');

exports.handler = function (event, context, callback) {
    var connection = mysql.createConnection({
        host: 'host',
        user: 'user',
        password: 'password',
        database: 'db'
    });

    connection.connect();
    console.log(event.start_date, event.end_date);
    var start = Date.parse(event.start_date);
    var end = Date.parse(event.end_date);
    console.log(start, end);
    var data = [];

    var query = connection.query("SELECT * FROM solar_data.energy_data WHERE DateTime BETWEEN ? AND ?", [start, end]);
    query
      .on('error', function(err){
        throw err;
      })
      .on('result', function(row){
          var dataObj = {
              "time": new Date(row.DateTime).toJSON(),
              generated_kwh: row.generated_kwh,
              used_kwh: row.used_kwh
          };
          data.push(dataObj);
      })
      .on('end', function(){
        callback(null, data);
        connection.end();
      });

};

/*
 *
 * Request Format:
 * {
 *  "start_date": "YYYY-MM-DD"
 *  "end_date": "YYYY-MM-DD"
 * }
 *
 */
