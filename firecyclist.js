// (c) Wilson Berkow
// Firecyclist.js

(function () {
    "use strict";
    // Screen-resizing code:
    var htmlModule = document.getElementById("canvas"),
        htmlBody = document.querySelector("body"),
        windowDims = {
            "width": window.innerWidth || document.documentElement.clientWidth, // The defaulting expression (.documentElement....) is for IE
            "height": window.innerHeight || document.documentElement.clientHeight
        },
        pageScaleFactor = 1,
        moduleOffsetX = 0,
        resize = function () { // This zooms the page so that the Firecyclist rectangle (initially always (576/2) by (1024/2) in dimensions), fits to the page.
            var scaleX = windowDims.width / (576 / 2),
                scaleY = windowDims.height / (1024 / 2),
                unfitAxis;
            pageScaleFactor = Math.min(scaleX, scaleY);
            unfitAxis = pageScaleFactor === scaleX ? "y" : "x";
            htmlBody.setAttribute("style", [ // Using htmlBody.style[property] didn't work, but just using setAttribute is fine here as this is the only style that will ever be applied.
                "-moz-transform-origin: 0 0",
                "-moz-transform: scale(" + pageScaleFactor + ")",
                "-webkit-transform-origin: 0 0",
                "-webkit-transform: scale(" + pageScaleFactor + ")",
                "-ms-transform-origin: 0 0",
                "-ms-transform: scale(" + pageScaleFactor + ")"
            ].join("; "));
            if (unfitAxis === "x") {
                moduleOffsetX = ((windowDims.width - (576 / 2) * pageScaleFactor) / 2) / pageScaleFactor; // The last division, by pageScaleFactor, is there because the zoom done above will automatically scale this whole expression/offest by pageScaleFactor, so the division undoes that.
                htmlModule.setAttribute("style", "position: fixed; left: " + Math.floor(moduleOffsetX) + "px;");
            }
        },
        calcTouchPos = function (event) {
            var usingOriginalEvent = typeof event.clientX !== "number";
            return {
                "x": (typeof event.clientX === "number" ? event.clientX : event.originalEvent.changedTouches[0].clientX) / pageScaleFactor - moduleOffsetX,
                "y": (typeof event.clientY === "number" ? event.clientY : event.originalEvent.changedTouches[0].clientY) / pageScaleFactor
            };
        },
        handleTouchend,
        curTouch = null,
        highscores = (function () {
            var highscores = [null, null, null]; // Highest scores are at the beginning, null represents an empty slot.
            return {
                highest: function (n) { // Note that the nulls of empty slots are included
                    var arr = [], i;
                    n = n || highscores.length;
                    for (i = 0; i < Math.min(n, highscores.length); i += 1) {
                        arr.push(highscores[i]);
                    }
                    return arr;
                },
                sendScore: function (score) {
                    var i;
                    for (i = 0; i < highscores.length; i += 1) {
                        if (score > highscores[i] || highscores[i] == null) {
                            highscores.splice(i, 0, score);
                            highscores.splice(highscores.length - 1, 1);
                            return true;
                        }
                    }
                    return false;
                }
            };
        }());
    resize();
    (function () { // Simple Touch system, mirroring Elm's
        var touchesCount = 0;
        jQuery(document).on("touchmove", function (event) {
            var xy = calcTouchPos(event);
            if (curTouch !== null) { // Should always pass
                curTouch.x = xy.x;
                curTouch.y = xy.y;
            }
            event.preventDefault(); // Stops the swipe-to-move-through-browser-history feature in Chrome from interferring.
        });
        jQuery(document).on("touchstart", function (event) {
            var now = Date.now(), xy = calcTouchPos(event);
            curTouch = {
                "t0": now,
                "id": touchesCount,
                "x0": xy.x,
                "y0": xy.y,
                "x":  xy.x,
                "y":  xy.y
            };
            touchesCount += 1;
        });
        jQuery(document).on("touchend", function (event) {
            if (typeof handleTouchend === "function") {
                handleTouchend(curTouch);
            }
            curTouch = null;
            // Do not use preventDefault here, it prevents
            // triggering of the 'tap' event.
        });
    }());
    var // CONFIG:
        framerate = 40,
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
        playerTorsoLen = 15,
        playerRadius = 10,
        playerHeadRadius = 9,
        playerElbowXDiff = 8,
        playerElbowYDiff = 2,
        pauseBtnCenterX = 10,
        pauseBtnCenterY = -5,
        pauseBtnRadius = 65,
        restartBtnCenterX = canvasWidth - 10,
        restartBtnCenterY = -5,
        restartBtnRadius = 65,
        menuPlayBtnX = canvasWidth / 2,
        menuPlayBtnY = 310,
        menuPlayBtnW = 121,
        menuPlayBtnH = 44,
        
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
                drawPlayerAt(game.player.x, game.player.y, game.player.wheelAngle);
                game.platfms.forEach(drawPlatfm);
                game.fbs.forEach(drawFb);
                game.coins.forEach(drawCoin);
                drawPauseBtn(game);
                drawRestartBtn(game);
                drawInGamePoints(game.points);
            }),
            drawGamePaused = gameOverlayDrawer(function (ctx, game) {
                ctx.fillStyle = "darkOrange";
                ctx.font = "bold 54px monospace";
                ctx.textAlign = "center";
                ctx.fillText("Paused", canvasWidth / 2, canvasHeight / 2 - 12);
            }),
            drawGameDead = gameOverlayDrawer(function (ctx, game) {
                // 'Game Over' text
                ctx.fillStyle = "darkOrange";
                ctx.font = "bold italic 90px monospace";
                ctx.textAlign = "center";
                ctx.fillText("Game", canvasWidth / 2, 110);
                ctx.fillText("Over", canvasWidth / 2, 195);
                
                // Points big
                ctx.font = "bold 140px monospace";
                ctx.fillText(Math.floor(game.points), canvasWidth / 2, canvas.height * 2 / 3 - 18);
                
                // Line separator
                ctx.beginPath();
                ctx.strokeStyle = "darkOrange";
                ctx.moveTo(30, 370);
                ctx.lineTo(canvasWidth - 30, 370);
                ctx.moveTo(30, 372);
                ctx.lineTo(canvasWidth - 30, 372);
                ctx.stroke();
                
                // Highscores
                ctx.font = "bold italic 24px monospace";
                ctx.fillText("Highscores", canvasWidth / 2, 410);
                ctx.font = "bold 24px monospace";
                var highest = highscores.highest().map(function (score) {
                    return score === null ? "\u2014" : String(score); // Em-dash for empty slots
                });
                ctx.fillText(highest.join(" "), canvasWidth / 2, 439);
            }),
            drawBackground = drawer(function (ctx) {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = "rgba(175, 175, 255, 0.75)"
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }),
            drawPlayerAt = drawer(function (ctx, x, y, angle) {
                drawHeadAt(x, y - playerTorsoLen - playerRadius - playerHeadRadius);
                line(ctx, x, y - playerTorsoLen - playerRadius, x, y);
                drawOneArm(x, y, 1);
                drawOneArm(x, y, -1);
                drawWheelAt(x, y, angle);
            }),
            drawOneArm = drawer(function (ctx, x, y, reverse) {
                ctx.translate(x, y - playerRadius - playerTorsoLen / 2);
                ctx.scale(reverse, reverse);
                line(ctx, 0, 0,
                          -playerElbowXDiff, -playerElbowYDiff);
                line(ctx, -playerElbowXDiff, -playerElbowYDiff,
                          -2 * playerElbowXDiff, playerElbowYDiff);
            }),
            drawHeadAt = drawer(function (ctx, x, y) {
                circle(ctx, x, y, playerHeadRadius, "black", "stroke");
            }),
            drawWheelAt = drawer(function (ctx, x, y, angle) {
                circle(ctx, x, y, playerRadius, "black", "stroke");
                [0, 1, 2, 3, 4, 5].forEach(function (sixths) {
                    drawSpoke(x, y, sixths / 6, angle);
                });
            }),
            drawSpoke = drawer(function (ctx, x, y, turnAmt, extraAngle) {
                ctx.strokeStyle = "black";
                ctx.beginPath();
                ctx.translate(x, y);
                ctx.rotate(2 * Math.PI * turnAmt);
                ctx.rotate(extraAngle * Math.PI / 180);
                ctx.moveTo(-playerRadius, 0);
                ctx.lineTo(playerRadius, 0);
                ctx.stroke();
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
            drawPauseBtn = drawer(function (ctx, game) {
                var colory = !game.dead && (game.paused || (curTouch && isOverPauseBtn(curTouch)));
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)"
                ctx.arc(pauseBtnCenterX, pauseBtnCenterY, pauseBtnRadius, 0, 2 * Math.PI, true);
                ctx.fill();
                ctx.font = "bold " + pxSize + "px arial";
                fillShadowyText(ctx, "II", 15, 15 + pxSize / 2, colory);
            }),
            drawRestartBtn = drawer(function (ctx, game) {
                var colory = !game.dead && !game.paused && curTouch && isOverRestartBtn(curTouch);
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)"
                ctx.arc(restartBtnCenterX, restartBtnCenterY, restartBtnRadius, 0, 2 * Math.PI, true);
                ctx.fill();
                ctx.font = "bold " + (pxSize + 5) + "px arial";
                fillShadowyText(ctx, "\u27F2", canvasWidth - 25 - pxSize / 2, 17 + pxSize / 2, colory);
            }),
            drawInGamePoints = drawer(function (ctx, points) {
                ctx.textAlign = "center";
                ctx.font = "bold 30px monospace";
                fillShadowyText(ctx, Math.floor(points), canvasWidth / 2, 28);
            }),
            fillShadowyText = function (ctx, text, x, y, reverse, offsetAmt) { // Intentionally doesn't open up a new drawing session, so that other styles can be set beforehand.
                var clr0 = reverse ? "black" : "darkOrange",
                    clr1 = reverse ? "darkOrange" : "black",
                    offset = offsetAmt || 1;
                ctx.fillStyle = clr0;
                ctx.fillText(text, x, y);
                ctx.fillStyle = clr1;
                ctx.fillText(text, x + offset, y - offset);
            },
            circle = function (ctx, x, y, radius, color, fillOrStroke) {
                ctx.beginPath();
                ctx[fillOrStroke + "Style"] = color;
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                ctx[fillOrStroke]();
            },
            line = function (ctx, x0, y0, x1, y1, color) {
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
            },
            drawMenu = drawer(function (ctx, menu) {
                drawBackground();
                menu.fbs.forEach(drawFb);
                drawMenuTitle();
                drawMenuPlayBtn();
            }),
            drawMenuTitle = drawer(function (ctx) {
                ctx.font = "italic bold 170px arial";
                ctx.textAlign = "center";
                fillShadowyText(ctx, "Fire", canvasWidth / 2 - 3, 190, true, 3);
                ctx.font = "italic bold 95px arial";
                fillShadowyText(ctx, "cyclist", canvasWidth / 2 - 3, 240, true, 2);
            }),
            roundedRect = function (ctx, x, y, width, height, radius, fillOrStroke) { // Based on function by Juan Mendes at http://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-on-html-canvas
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx[fillOrStroke]();
            },
            drawMenuPlayBtn = drawer(function (ctx) {
                ctx.font = "italic bold 54px monospace";
                ctx.textAlign = "center";
                ctx.fillStyle = "rgb(150, 140, 130)";
                ctx.fillText("Play", menuPlayBtnX, menuPlayBtnY, menuPlayBtnW, menuPlayBtnH);
            });
        return [drawGame, drawGamePaused, drawGameDead, drawPreviewPlatfm, drawMenu];
    }());
    var drawGame = renderers[0], drawGamePaused = renderers[1], drawGameDead = renderers[2], drawPreviewPlatfm = renderers[3], drawMenu = renderers[4];
    
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
                return {"is": "ball", "x": x, "y": y, "vx": vx, "vy": vy, "wheelAngle": 0};
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
                    "paused": false,
                    "dead": false
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
            playerIntersectingPlatfm = function (player, platfm) {
                // Make sure that the ball is in the square who's opposite
                // corners are the endpoints of the platfm. Necessary because
                // the algorithm for testing intersection used below is made
                // for (infinite) lines, not line segments, which the platfm is.
                var rad = playerRadius + platfmThickness,
                    startx = Math.min(platfm.x0, platfm.x1),
                    starty = Math.min(platfm.y0, platfm.y1),
                    endx = Math.max(platfm.x0, platfm.x1),
                    endy = Math.max(platfm.y0, platfm.y1);
                if (player.x + rad < startx || player.x - rad > endx || player.y + rad < starty || player.y - rad > endy) {
                    return false;
                }
                
                // Algorithm from http://mathworld.wolfram.com/Circle-LineIntersection.html
                var offsetStartX = platfm.x0 - player.x,
                    offsetStartY = platfm.y0 - player.y,
                    offsetEndX = platfm.x1 - player.x,
                    offsetEndY = platfm.y1 - player.y,
                    platLength = dist(platfm.x0, platfm.y0, platfm.x1, platfm.y1),
                    bigD = offsetStartX * offsetEndY - offsetEndX * offsetStartY;
                return Math.pow(rad * platLength, 2) >= bigD * bigD;
            },
            playerHittingFb = function (player, fb) {
                return dist(player.x, player.y, fb.x, fb.y) < playerRadius + fbRadius;
            },
            playerHittingCoin = function (player, coin) {
                return dist(player.x, player.y, coin.x, coin.y) < playerRadius + coinRadius;
            },
            updateFbsGeneric = function (fbArray, dt) { // This is used in both playGame and runMenu, and thus must be declared here.
                // fbArray can't be abstracted out and used in closure, because
                // every new game uses a different 'fbs' array and 'game' object
                fbArray.forEach(function (fb, index) {
                    fb.y -= fbFallRate * dt;
                    if (fb.y < -totalFbHeight) {
                        fbArray.splice(index, 1);
                    }
                });
                if (Math.random() < 1 / 1000 * dt) {
                    fbArray.push(createFb(Math.random() * canvasWidth, canvasHeight + fbRadius));
                }
            },
            
            // PLAY:
            playGame = function () {
                var
                    game = createGame(),
                    updatePlayer = function (dt) {
                        var i, platfm, playerAngle = game.player.angle(), platfmAngle, tmpVel, collided = false;
                        if (game.player.y > canvasHeight + playerRadius) {
                            die();
                            // The frame finishes, with all other components also
                            // being updated before the GameOver screen apperas, so
                            // so does the player's position. This is why there is
                            // no 'return;' here.
                        }
                        for (i = 0; i < game.platfms.length; i += 1) {
                            platfm = game.platfms[i];
                            platfmAngle = platfm.angle();
                            if (playerIntersectingPlatfm(game.player, platfm)) {
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
                                die();
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
                        game.player.wheelAngle += signNum(game.player.vx) * 0.15 * dt;
                    },
                    updateFbs = function (dt) {
                        updateFbsGeneric(game.fbs, dt);
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
                    die = function () {
                        game.dead = true;
                        highscores.sendScore(Math.floor(game.points));
                    },
                    restart = function () {
                        // intervalId isn't cleared because the same interval is
                        // used for the next game (after the restart).
                        game = createGame();
                    },
                    prevFrameTime = Date.now(),
                    intervalId;
                window.game = game; // FOR DEBUGGING. It is a good idea to have this in case a see an issue at an unexpected time.
                intervalId = setInterval(function () {
                    // Handle time (necessary, regardless of pausing)
                    var now = Date.now(), dt = now - prevFrameTime;
                    prevFrameTime = now;
                    
                    // Handle state changes
                    if (game.paused) {
                        drawGamePaused(game);
                    } else if (game.dead) {
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
                handleTouchend = function (touch) { // TODO: CHANGE TO A VIABLE SOLUTION (i.e. one that doesn't involve global variables)
                    if (!game.paused && !game.dead) {
                        game.platfms.push(createPlatfm(touch.x0, touch.y0, touch.x, touch.y));
                    }
                };
                jQuery(document).on("click", function (event) {
                    var p;
                    if (game.paused) { // Tap *anywhere* to unpause
                        game.paused = false;
                    } else if (game.dead) { // Tap *anywhere* to restart from GameOver screen.
                        restart();
                    } else { // Tap on the pause btn to pause
                        p = calcTouchPos(event);
                        if (isOverPauseBtn(p)) {
                            game.paused = true;
                        } else if (isOverRestartBtn(p)) {
                            restart();
                        }
                    }
                });
            },
            createMenu = function () { return {fbs: []}; },
            runMenu = function () {
                var menu = createMenu(),
                    updateButtons = function () {},
                    updateFbs = function (dt) {
                        updateFbsGeneric(menu.fbs, dt);
                    },
                    intervalId,
                    prevTime = Date.now();
                window.menu = menu;
                intervalId = setInterval(function () {
                    var now = Date.now(), dt = now - prevTime;
                    prevTime = now;
                    updateButtons();
                    updateFbs(dt);
                    drawMenu(menu);
                }, 1000 / framerate);
                jQuery(document).one("click", function (event) {
                    clearInterval(intervalId);
                    playGame();
                });
            };
        return runMenu;
    }());
    playGame();
}());