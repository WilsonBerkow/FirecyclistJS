// (c) Wilson Berkow
// Firecyclist.js

(function () {
    "use strict";
    var // CONFIG:
        framerate = 60,
        canvasWidth = 576 / 2,
        canvasHeight = 1024 / 2,
        playerGrav = 0.3 / 28,
        fbFallRate = 2 / 20,
        fbRadius = 10,
        coinFallRate = 2 / 20,
        coinRadius = 10,
        platfmFallRate = 3 / 20,
        totalFbHeight = 10,
        platfmBounciness = 0.75,
        platfmThickness = 6,
        playerRadius = 10,
        pauseBtnCenterX = 10,
        pauseBtnCenterY = -5,
        pauseBtnRadius = 65,
        restartBtnCenterX = canvasWidth - 10,
        restartBtnCenterY = -5,
        restartBtnRadius = 65,
        
        // UTIL:
        makeObject = function (proto, props) {
            var o = Object.create(proto);
            Object.keys(props).forEach(function (key) {
                o[key] = props[key];
            });
            return o;
        },
        modulo = function (num, modBy) {
            return num > modBy ? modulo(num - modBy, modBy) :
                   num < 0 ? modulo(num + modBy, modBy) :
                   num;
        },
        pythag = function (a, b) { return Math.sqrt(a*a + b*b); },
        dist = function (x0, y0, x1, y1) { return pythag(x1 - x0, y1 - y0); },
        isOverPauseBtn = function (xy) {
        return dist(xy.x, xy.y, pauseBtnCenterX, pauseBtnCenterY) < pauseBtnRadius;
        },
        isOverRestartBtn = function (xy) {
            return dist(xy.x, xy.y, restartBtnCenterX, restartBtnCenterY) < restartBtnRadius;
        };
    
    // RENDER:
    var renderers = (function () {
        var drawer = (function () {
                var ctx = document.getElementById("canvas").getContext("2d");
                return function (draw) { // Opens a "drawing session"
                    return function () {
                        ctx.save();
                        draw.apply(null, [ctx].concat([].slice.apply(arguments)));
                        ctx.restore();
                    };
                };
            }()),
            gameOverlayDrawer = (function () { // Specialized version of 'drawer' for drawing game overlays like the Paused or GameOver screens.
                var vagueify = drawer(function (ctx) {
                    ctx.fillStyle = "rgba(200, 200, 200, 0.75)";
                    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                });
                return function (f) {
                    var overlawDrawer = drawer(f);
                    return drawer(function (ctx, game) {
                        var args = [].slice.apply(arguments).slice(1);
                        drawGame(game);
                        vagueify();
                        overlawDrawer.apply(null, args); // 'args' includes 'game'
                    });
                };
            }()),
            drawGame = drawer(function (ctx, game) {
                drawBackground();
                drawPlayerAt(game.player.x, game.player.y);
                game.platfms.forEach(drawPlatfm);
                game.fbs.forEach(drawFb);
                game.coins.forEach(drawCoin);
                drawPauseBtn(game.paused);
                drawRestartBtn();
                drawInGamePoints(game.points);
            }),
            drawGamePaused = gameOverlayDrawer(function (ctx, game) {
                ctx.fillStyle = "orange";
                ctx.font = "48px monospace";
                ctx.textAlign = "center";
                ctx.fillText("Paused", canvasWidth / 2, canvasHeight / 2 - 12);
            }),
            drawGameDead = gameOverlayDrawer(function (ctx, game) {
                // 'Game Over' text
                ctx.fillStyle = "orange";
                ctx.font = "96px monospace";
                ctx.textAlign = "center";
                ctx.fillText("Game", canvasWidth / 2, 100);
                ctx.fillText("Over", canvasWidth / 2, 175);
                
                // Points big
                ctx.font = "140px monospace";
                ctx.fillText(Math.floor(game.points), canvasWidth / 2, canvas.height * 2 / 3);
            }),
            drawBackground = drawer(function (ctx) {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = "rgba(175, 175, 255, 0.75)"
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }),
            drawPlayerAt = drawer(function (ctx, x, y) {
                ctx.beginPath();
                ctx.fillStyle = "darkBlue";
                ctx.arc(x, y, playerRadius, 0, 2 * Math.PI, false);
                ctx.fill();
            }),
            drawFb = drawer(function (ctx, fb) {
                ctx.beginPath();
                ctx.fillStyle = "red"
                ctx.moveTo(fb.x - fbRadius + 2, fb.y + fbRadius / 2);
                ctx.lineTo(fb.x, fb.y + fbRadius * 2);
                ctx.lineTo(fb.x + fbRadius - 2, fb.y + fbRadius / 2);
                ctx.fill();
                // 
                ctx.beginPath();
                ctx.fillStyle = "orange";
                ctx.arc(fb.x, fb.y, fbRadius, 0, 2 * Math.PI, false);
                ctx.fill();
                // 
                ctx.beginPath();
                ctx.strokeStyle = "red";
                ctx.arc(fb.x, fb.y, fbRadius, 0, 2 * Math.PI, false);
                ctx.stroke();
            }),
            drawCoin = drawer(function (ctx, coin) {
                var squareLen = 8.5;
                ctx.lineWidth = 2;
                circle(ctx, coin.x, coin.y, coinRadius, "yellow", "fill");
                circle(ctx, coin.x, coin.y, coinRadius, "orange", "stroke");
                ctx.fillStyle = "darkOrange";
                ctx.fillRect(coin.x - squareLen / 2, coin.y - squareLen / 2, squareLen, squareLen);
                ctx.strokeStyle = "orange";
                ctx.strokeRect(coin.x - squareLen / 2, coin.y - squareLen / 2, squareLen, squareLen);
            }),
            drawPlatfm = drawer(function (ctx, p) {
                ctx.beginPath();
                ctx.globalAlpha = Math.max(0, p.time_left / 1000);
                ctx.strokeStyle = "black";
                ctx.lineWidth = platfmThickness;
                ctx.lineCap = "round";
                ctx.lineJoin = "smooth";
                ctx.moveTo(p.x0, p.y0);
                ctx.lineTo(p.x1, p.y1);
                ctx.stroke();
            }),
            drawPreviewPlatfm = drawer(function (ctx, touch) {
                ctx.beginPath();
                ctx.strokeStyle = "grey";
                ctx.lineWidth = platfmThickness;
                ctx.lineCap = "round";
                ctx.lineJoin = "smooth";
                ctx.moveTo(touch.x0, touch.y0);
                ctx.lineTo(touch.x, touch.y);
                ctx.stroke();
            }),
            pxSize = 36,
            drawPauseBtn = drawer(function (ctx, paused) {
                var colory = paused || (curTouch && isOverPauseBtn(curTouch));
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)"
                ctx.arc(pauseBtnCenterX, pauseBtnCenterY, pauseBtnRadius, 0, 2 * Math.PI, true);
                ctx.fill();
                ctx.font = pxSize + "px arial";
                fillShadowyText(ctx, "II", 15, 15 + pxSize / 2, colory);
            }),
            drawRestartBtn = drawer(function (ctx) {
                var colory = curTouch && isOverRestartBtn(curTouch);
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)"
                ctx.arc(restartBtnCenterX, restartBtnCenterY, restartBtnRadius, 0, 2 * Math.PI, true);
                ctx.fill();
                ctx.font = (pxSize + 5) + "px arial";
                fillShadowyText(ctx, "⟲", canvasWidth - 25 - pxSize / 2, 17 + pxSize / 2, colory);
            }),
            drawInGamePoints = drawer(function (ctx, points) {
                ctx.textAlign = "center";
                ctx.font = "30px monospace";
                fillShadowyText(ctx, Math.floor(points), canvasWidth / 2, 25);
            }),
            fillShadowyText = function (ctx, text, x, y, reverse) { // Intentionally doesn't open up a new drawing session, so that other styles can be set beforehand.
                var clr0 = reverse ? "black" : "orange", clr1 = reverse ? "orange" : "black";
                ctx.fillStyle = clr0;
                ctx.fillText(text, x, y);
                ctx.fillStyle = clr1;
                ctx.fillText(text, x + 1, y - 1);
            },
            circle = function (ctx, x, y, radius, color, fillOrStroke) {
                ctx.beginPath();
                ctx[fillOrStroke + "Style"] = color;
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                ctx[fillOrStroke]();
            };
        return [drawGame, drawGamePaused, drawGameDead, drawPreviewPlatfm];
    }());
    var drawGame = renderers[0], drawGamePaused = renderers[1], drawGameDead = renderers[2], drawPreviewPlatfm = renderers[3];
    
    // PLAY:
    var playGame = (function (drawFns) {
        var // MODEL + CALC:
            anglify = function (doCalc, f) {
                var proto = {
                    angle: function () {
                        if (doCalc) {
                            return Math.atan2(this.y1 - this.y0, this.x1 - this.x0);
                        } else {
                            return Math.atan2(this.vy, this.vx);
                        }
                    },
                    magnitude: function () {
                        if (doCalc) {
                            return dist(this.x0, this.y0, this.x1, this.y1);
                        } else {
                            return pythag(this.vx, this.vy);
                        }
                    },
                    slope: function () {
                        if (doCalc) {
                            return (this.y1 - this.y0) / (this.x1 - this.x0);
                        } else {
                            return this.vy / this.vx;
                        }
                    }
                };
                if (!doCalc) {
                    proto.setAngle = function (theta) {
                        this.vx = Math.cos(theta) * this.magnitude();
                        this.vy = Math.sin(theta) * this.magnitude();
                    };
                    proto.setMagnitude = function (mag) {
                        this.vx = Math.cos(this.angle()) * mag;
                        this.vy = Math.sin(this.angle()) * mag;
                    };
                    proto.scaleMagnitude = function (scaleFactor) {
                        this.vx *= scaleFactor;
                        this.vy *= scaleFactor;
                    };
                }
                return function () {
                    return makeObject(proto, f.apply(this, [].slice.apply(arguments)));
                };
            },
            createPlayer = anglify(false, function (x, y, vx, vy) {
                return {"is": "ball", "x": x, "y": y, "vx": vx, "vy": vy};
            }),
            createPlatfm = anglify(true, function (x0, y0, x1, y1) {
                return {"is": "platfm", "x0": x0, "y0": y0, "x1": x1, "y1": y1, "time_left": 800};
            }),
            createCoin = function (x, y) {
                return {"is": "coin", "x": x, "y": y};
            },
            createFb = function (x, y) {
                return {"is": "fb", "x": x, "y": y};
            },
            createGame = function () {
                return {
                    "player": createPlayer(canvasWidth / 2, 50, 0, 0),
                    "platfms": [],
                    "fbs": [],
                    "coins": [],
                    "points": 0,
                    "paused": false
                };
            },
            signNum = function (num) {
                return num > 0 ? 1 :
                       num < 0 ? -1 :
                       0;
            },
            velFromPlatfm = function (dt, platfm) {
                var slope = platfm.slope();
                return {
                    "x": signNum(slope) * 3,
                    "y": Math.abs(slope) * 3 - platfmFallRate * dt - platfmBounciness
                };
            },
            playerIntesectingPlatfm = function (player, platfm) {
                var
                    rad = playerRadius + platfmThickness,
                    startx = Math.min(platfm.x0, platfm.x1),
                    starty = Math.min(platfm.y0, platfm.y1),
                    endx = Math.max(platfm.x0, platfm.x1),
                    endy = Math.max(platfm.y0, platfm.y1),
                    platLength = dist(platfm.x0, platfm.y0, platfm.x1, platfm.y1);
                if (player.x + rad < startx || player.x - rad > endx || player.y + rad < starty || player.y - rad > endy) {
                    return false;
                }
                var
                    offsetStartX = startx - player.x,
                    offsetStartY = starty - player.y,
                    offsetEndX = endx - player.x,
                    offsetEndY = endy - player.y,
                    bigD = offsetStartX * offsetEndY - offsetEndX * offsetStartY; // Mathematical algorithm
                return Math.abs(rad * platLength) > Math.abs(bigD);
            },
            playerHittingFb = function (player, fb) {
                return dist(player.x, player.y, fb.x, fb.y) < playerRadius + fbRadius;
            },
            playerHittingCoin = function (player, coin) {
                return dist(player.x, player.y, coin.x, coin.y) < playerRadius + coinRadius;
            },
            
            // PLAY:
            playGame = function () {
                var
                    game = createGame(),
                    isDead = false,
                    updatePlayer = function (dt) {
                        var i, platfm, playerAngle = game.player.angle(), platfmAngle, tmpVel, collided = false;
                        if (game.player.y > canvasHeight + playerRadius) {
                            isDead = true;
                            // The frame finishes, with all other components also
                            // being updated before the GameOver screen apperas, so
                            // so does the player's position. This is why there is
                            // no 'return;' here.
                        }
                        for (i = 0; i < game.platfms.length; i += 1) {
                            platfm = game.platfms[i];
                            platfmAngle = platfm.angle();
                            if (playerIntesectingPlatfm(game.player, platfm)) {
                                //game.player.setAngle(2 * platfmAngle - playerAngle);
                                //game.player.scaleMagnitude(Math.sqrt(Math.sqrt(playerAngle / modulo(-1 / platfmAngle, 2 * Math.PI))));
                                //game.platfms.splice(i, 1);
                                tmpVel = velFromPlatfm(dt, platfm);
                                game.player.vx = tmpVel.x;
                                game.player.vy = tmpVel.y;
                                collided = true;
                            }
                        }
                        if (!collided) {
                            game.player.vy += playerGrav * dt;
                        }
                        for (i = 0; i < game.fbs.length; i += 1) {
                            if (playerHittingFb(game.player, game.fbs[i])) {
                                isDead = true;
                            }
                        }
                        game.coins.forEach(function (coin, index) {
                            if (playerHittingCoin(game.player, coin)) {
                                game.coins.splice(index, 1);
                                game.points += 5;
                            }
                        });
                        game.player.x += game.player.vx * dt / 20;
                        game.player.y += game.player.vy * dt / 20;
                        game.player.x = modulo(game.player.x, canvasWidth);
                    },
                    updateCoins = function (dt) {
                        game.coins.forEach(function (coin, index) {
                            coin.y -= coinFallRate * dt;
                            if (coin.y < -2 * coinRadius) {
                                game.coins.splice(index, 1);
                            }
                        });
                        if (Math.random() < 1 / (1000 * 10/4) * dt) { // The '* 10/4' is drawn from the use of the 'likelihood' argument in 'randomly_create_x'
                            game.coins.push(createCoin(Math.random() * canvasWidth, canvasHeight + coinRadius));
                        }
                    },
                    updateFbs = function (dt) {
                        game.fbs.forEach(function (fb, index) {
                            fb.y -= fbFallRate * dt;
                            if (fb.y < -totalFbHeight) {
                                game.fbs.splice(index, 1);
                            }
                        });
                        if (Math.random() < 1 / 1000 * dt) {
                            game.fbs.push(createFb(Math.random() * canvasWidth, canvasHeight + fbRadius));
                        }
                    },
                    updatePlatfms = function (dt) {
                        game.platfms.forEach(function (platfm, index) {
                            platfm.y0 -= platfmFallRate * dt;
                            platfm.y1 -= platfmFallRate * dt;
                            platfm.time_left -= dt;
                            if (platfm.time_left <= 0) {
                                game.platfms.splice(index, 1);
                            }
                        });
                    },
                    restart = function () {
                        game = createGame();
                        isDead = false;
                    },
                    prevFrameTime = Date.now();
                window.game = game; // FOR DEBUGGING
                setInterval(function () {
                    // Handle time (necessary, regardless of pausing)
                    var now = Date.now(), dt = now - prevFrameTime;
                    prevFrameTime = now;
                    
                    // Handle state changes
                    if (game.paused) {
                        drawGamePaused(game);
                    } else if (isDead) {
                        drawGameDead(game);
                    } else {
                        // Update state
                        updatePlayer(dt);
                        updateCoins(dt);
                        updateFbs(dt);
                        updatePlatfms(dt);
                        game.points += 2 * (dt / 1000) * (1 + game.player.y / canvasHeight);
                        // Point logic from Elm:
                        //  points <- g.points + 2 * (Time.inSeconds dt) * (1 + g.player.pos.y / toFloat game_total_height) + points_from_coins
                        
                        // Render
                        drawGame(game);
                        if (curTouch) {
                            drawPreviewPlatfm(curTouch);
                        }
                    }
                }, 1000 / framerate);
                window.handleTouchend = function (touch) { // TODO: CHANGE TO A VIABLE SOLUTION
                    game.platfms.push(createPlatfm(touch.x0, touch.y0, touch.x, touch.y));
                };
                jQuery(document).on("click", function (event) {
                    var p;
                    if (game.paused) { // Tap *anywhere* to unpause
                        game.paused = false;
                    } else if (isDead) { // Tap *anywhere* to restart from GameOver screen.
                        restart();
                    } else { // Tap on the pause btn to pause
                        p = calcPos(event);
                        if (isOverPauseBtn(p)) {
                            game.paused = true;
                        } else if (isOverRestartBtn(p)) {
                            restart();
                        }
                    }
                });
            };
        return playGame;
    }());
    window.playGame = playGame;
}());