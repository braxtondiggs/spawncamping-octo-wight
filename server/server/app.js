/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var express = require('express');
var config = require('./config/environment');
// Setup server
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var Kaiseki = require('kaiseki');
var request = require('request');
var cheerio = require('cheerio');
var echonest = require('echonest');
var trim = require('trim');
require('./config/express')(app);
require('./routes')(app);

// Start server
server.listen(config.port, config.ip, function() {
    console.log('Express server listening on %d, in %s mode1', config.port, app.get('env'));
});

var APP_ID = 'GxJOG4uIVYMnkSuRguq8rZhTAW1f72eOQ2uXWP0k';
var REST_API_KEY = '3lVlmpc7FZg1EVL9Lg6Hfo68xEP4yMnurm9zT38z';

var kaiseki = new Kaiseki(APP_ID, REST_API_KEY);
var myNest = new echonest.Echonest({
    api_key: '0NPSO7NBLICGX3CWQ'
});

io.sockets.on('connection', function(socket) {
    console.log('connected!');
    socket.on('user:init', function(msg, fn) {
        socket.join(msg.room);
        kaiseki.getObjects('Playlist', {
            where: {
                playerId: msg.room
            },
            order: 'createdAt'
        }, function(err, res, body, success) {
            fn(body);
        });
    })
    socket.on('server:init', function(msg, fn) {
        socket.join(msg.room);
        kaiseki.getObjects('Playlist', {
            where: {
                playerId: msg.room
            },
            order: 'createdAt',
            count: true
        }, function(err, res, body, success) {
            console.log(body.results);
            if (body.count > 0) {
                fn(body.results);
            } else {
                emptyQueue('Taylor Swift', msg.room);
            }
        });
    });
    socket.on('unsubscribe', function(msg) {
        socket.leave(msg.room);
    });
    socket.on("song:new", function(msg, fn) {
        console.log("add song");
        var track_id = msg.track_id,
            jukebox_id = msg.server_id,
            user_id = msg.user_id;
        var status = newSong(user_id, track_id, jukebox_id, fn);

    });
    socket.on('song:ended', function(msg, fn) {
        var room = msg.room,
            trackId = msg.trackId,
            artistInfo = msg.artistInfo;
        kaiseki.deleteObject('Playlist', trackId, function(err, res, body, success) {
            if (success) {
                kaiseki.getObjects('Playlist', {
                    where: {
                        playerId: msg.room
                    },
                    order: 'createdAt',
                    count: true
                }, function(err, res, body, success) {
                    if (success) {
                        if (body.count > 0) {
                            io.sockets.in(msg.room).emit("playlist:change", body.results);
                        } else {
                            emptyQueue(artistInfo, msg.room);
                        }
                    }
                });
            }
        });

    });

    function emptyQueue(artistInfo, jukebox_id) {
        myNest.artist.similar({
            name: artistInfo
        }, function(error, response) {
            var found = false;
            callAPIs(response.artists);

            function callAPIs(APIs) {
                if (APIs.length) {
                    var ran = Math.floor(Math.random() * APIs.length),
                        artist = APIs[ran].name;
                    request.get({
                        url: "http://imvdb.com/api/v1/search/entities?q=" + artist + "&per_page=1",
                        json: true
                    }, function(error, response, body) {
                        if (!error && response.statusCode === 200) {
                            if (body.results[0]) {
                                var artist_id = body.results[0].id;
                                if (artist_id) {
                                    request.get({
                                        url: "http://imvdb.com/api/v1/entity/" + artist_id + "?include=artist_videos,featured_videos", //distinctpos,credits - Used to get Apperances
                                        json: true
                                    }, function(error, response, body) {
                                        if (!error && response.statusCode === 200) {
                                            if (body.artist_videos.total_videos !== 0) {
                                                var videos = body.artist_videos.videos;
                                                var track_id = body.artist_videos.videos[Math.floor(Math.random() * (videos.length))].id; //Needs to search Featured Artist Also --- Could combine the two arrays and picks from that
                                                found = true;
                                                newSong('emptyQueue', track_id, jukebox_id, function() {
                                                    return;
                                                });
                                            }
                                        }
                                        if (!found) {
                                            APIs.splice(ran, 1);
                                            callAPIs(APIs);
                                        }
                                    });
                                }
                            }
                        }
                    });

                }
            }

        });
    }

    function newSong(user_id, track_id, jukebox_id, fn) {
        request({
            url: "http://imvdb.com/api/v1/video/" + track_id + "?include=sources",
            json: true
        }, function(error, response, body) {
            if (!error && response.statusCode === 200) {
                var sources = body.sources,
                    YT_Key = 0,
                    noMatch = true;
                for (var key in sources) {
                    if (sources[key].source === "youtube") {
                        YT_Key = key;
                        noMatch = false;
                    }
                    if (noMatch) {
                        returnData(2);
                        return false;
                    }
                }
                var post = {
                        IMVDBtrackId: body.id,
                        IMVDBartistId: body.artists[0].slug,
                        youtubeId: body.sources[YT_Key].source_data,
                        artistInfo: body.artists[0].name,
                        trackInfo: body.song_title,
                        imagePreview: body.image.o,
                        yearInfo: body.year || 2014,
                        playerId: jukebox_id,
                        userId: user_id,
                        upvoteNum: 0,
                        downvoteNum: 0
                    },
                    params = {
                        where: {
                            playerId: jukebox_id
                        }
                    };
                kaiseki.createObject('Playlist', post, function(err, res, body, success) {
                    kaiseki.getObjects('Playlist', params, function(err, res, body, success) {
                        io.sockets.in(jukebox_id).emit("playlist:change", body);
                        returnData(1);
                    });
                });
            }
        });

        function returnData(status) {
            fn({
                status: status
            });
        }
    }

    function getIMVDB(id, list, url) {
        request(url, function(error, response, html) {
            if (!error && response.statusCode === 200) {
                var $ = cheerio.load(html),
                    i = 0;
                $("table.imvdb-chart-table tr").each(function(i, element) {
                    var post_music = {
                        section: id,
                        artist_order: i,
                        artist_name: trim(($(this).find(".artist_line").next("p").text() || '')),
                        artist_title: trim(($(this).find(".artist_line a").attr("title") || '')),
                        artist_image: trim(($(this).find("img").attr("src") || ''))
                    };
                    /*connection.query("INSERT INTO jukebox_section_music SET ?", post_music, function(err, rows, results) {
                        if (err) throw err;
                    });*/
                    i++;
                    console.log("artist: " + post_music.artist_name + ", title: " + post_music.artist_title + ", image: " + post_music.artist_image);
                });
            }
        });
    }

    function genID(length) {
        var text = "",
            possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i = 0; i < length; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }
});

// Expose app
exports = module.exports = app;