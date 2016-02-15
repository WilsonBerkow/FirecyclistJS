// (c) Wilson Berkow
// Firecyclist.js

/*globals
    window requestAnimationFrame performance
*/

(function () {
    "use strict";
    var bgCanvas = document.getElementById("bgCanvas");
    var mainCanvas = document.getElementById("canvas");
    var btnCanvas = document.getElementById("btnCanvas");
    var overlayCanvas = document.getElementById("overlayCanvas");
    var gameWidth = 576 / 2;
    var gameHeight = 1024 / 2;

    // Resize and center game canvases:
    var pageScaleFactor = 1, calcTouchPos;
    (function () {
        var htmlModule = document.getElementById("Main"),
            windowDims = {
                // The defaulting expression (.documentElement....) is for IE
                width: window.innerWidth || document.documentElement.clientWidth,
                height: window.innerHeight || document.documentElement.clientHeight
            },
            scaleX = windowDims.width / gameWidth,
            scaleY = windowDims.height / gameHeight,
            moduleOffsetX = 0;

        pageScaleFactor = Math.min(scaleX, scaleY);

        if (scaleX > scaleY) {
            // If the game is as tall as the screen but not as wide, center it
            moduleOffsetX = (windowDims.width - gameWidth * pageScaleFactor) / 2;
            htmlModule.setAttribute("style", "position: fixed; left: " + Math.floor(moduleOffsetX) + "px;");
            // <body> is sky-blue while page is loading, but once it has loaded,
            // the canvas handles all color in the 288x576 so for phones with
            // resolutions not at exactly 2:1 screens, turn bg black:
            document.body.setAttribute("style", "background-color: black;");
        }

        calcTouchPos = function (event) {
            var literalX, literalY;
            if (typeof event.clientX === "number") {
                // These are tried to allow mouse to be instead of touches
                literalX = event.clientX;
                literalY = event.clientY;
            } else {
                literalX = event.changedTouches[0].clientX;
                literalY = event.changedTouches[0].clientY;
                // `event.changedTouches[0]` works when handling touchend,
                // at which point `event.touches[0]` would be undefined.
            }
            return {
                x: (literalX - moduleOffsetX) / pageScaleFactor,
                y: literalY / pageScaleFactor,
                rawX: literalX,
                rawY: literalY
            };
        };

        [bgCanvas, mainCanvas, btnCanvas, overlayCanvas].forEach(function (canvas) {
            canvas.width *= pageScaleFactor;
            canvas.height *= pageScaleFactor;
        });
    }());

    // Touch system:
    var Touch = (function () {
        var touchesCount = 0;

        document.addEventListener("touchmove", function (event) {
            var xy = calcTouchPos(event);
            if (Touch.curTouch) {
                // Condition fails when a platfm has been materialized,
                // and thus curTouch was reset to null
                Touch.curTouch.x1 = xy.x;
                Touch.curTouch.y1 = xy.y;
                Touch.curTouch.rawX1 = xy.rawX;
                Touch.curTouch.rawY1 = xy.rawY;
            }
            // `preventDefault()' to stop Chrome from moving
            // through browser history on swipes
            event.preventDefault();
        });

        document.addEventListener("touchstart", function (event) {
            var now = Date.now(), xy = calcTouchPos(event);
            Touch.curTouch = {
                t0: now,
                id: touchesCount,
                x0: xy.x,
                y0: xy.y,
                rawX0: xy.rawX,
                rawY0: xy.rawY,
                x1: xy.x,
                y1: xy.y,
                rawX1: xy.rawX,
                rawY1: xy.rawY
            };
            touchesCount += 1;
        });

        document.addEventListener("touchend", function () {
            if (Touch.curTouch) {
                if (typeof Touch.onTouchend === "function") {
                    Touch.onTouchend(Touch.curTouch);
                }
                Touch.curTouch = null;
            }
        });

        return Object.seal({
            curTouch: null,

            // `onTouchend' can be set, specifying a handler, called above
            onTouchend: null,

            touchIsValidAsTap: function (t) {
                if (Math.abs(t.rawX1 - t.rawX0) < 12
                        && Math.abs(t.rawY1 - t.rawY0) < 12) {
                    if (Date.now() - t.t0 < 350) {
                        return true;
                    }
                }
                return false;
            },

            copy: function (t) {
                return {
                    t0: t.t0,
                    id: t.id,
                    x0: t.x0,
                    y0: t.y0,
                    x1: t.x1,
                    y1: t.y1
                };
            },

            zeroLength: function (t) {
                return t.x0 === t.x1 && t.y0 === t.y1;
            }
        });
    }());

    // Generic util:
    var
        forEachInObject = function (obj, f) {
            var keys = Object.keys(obj), i;
            for (i = 0; i < keys.length; i += 1) {
                f(keys[i], obj[keys[i]]);
            }
        },

        modulo = function (num, modBy) {
            return num - modBy * Math.floor(num / modBy);
        },

        oneDegree = Math.PI / 180,
        trig = (function () {
            var
                // Sine and cosine tables are used so that the approximation
                // doesn't have to be done more than once for any given angle.
                // The angle inputs are rounded down to the nearest degree.
                sines = [],
                cosines = [],
                sin = function (radians) {
                    return sines[modulo(Math.round(radians / oneDegree), 360)];
                },
                cos = function (radians) {
                    return cosines[modulo(Math.round(radians / oneDegree), 360)];
                },
                i;

            for (i = 0; i < 360; i += 1) {
                sines[i] = Math.sin(i * oneDegree);
                cosines[i] = Math.cos(i * oneDegree);
            }

            return {sin: sin, cos: cos};
        }()),

        quickSqrt = (function () {
            var i;

            // Square root of x is at sqrtsLarge[x].
            // `sqrtsLarge' is defined initially for 0 <= x < 250,
            // but is extensible by memoization
            var sqrtsLarge = {};
            for (i = 0; i < 250; i += 1) {
                sqrtsLarge[i] = Math.sqrt(i);
            }

            // Square root of x is at sqrtsSmall[x * 50].
            // `sqrtsSmall' is defined for 0 <= x < 10
            var sqrtsSmallMax = 10;
            var sqrtsSmall = {};
            for (i = 0; i < sqrtsSmallMax * 50; i += 1) {
                sqrtsSmall[i] = Math.sqrt(i / 50);
            }

            return function (x) {
                if (x < sqrtsSmallMax) {
                    return sqrtsSmall[Math.round(x * 50)];
                }

                var pos = Math.round(x);
                if (sqrtsLarge[pos] === undefined) {
                    sqrtsLarge[pos] = Math.sqrt(pos);
                }
                return sqrtsLarge[pos];
            };
        }()),

        distanceSquared = function (x0, y0, x1, y1) {
            var dx = x1 - x0;
            var dy = y1 - y0;
            return dx * dx + dy * dy;
        },

        distLT = function (x0, y0, x1, y1, compareWith) {
            var distSquared = distanceSquared(x0, y0, x1, y1);
            return distSquared < compareWith * compareWith;
        },

        dist = function (x0, y0, x1, y1) {
            return quickSqrt(distanceSquared(x0, y0, x1, y1));
        },

        padNumericPeriod = function (num) {
            // E.g., if given 34, returns "034"
            return num < 10 ? "00" + num :
                   num < 100 ? "0" + num :
                   "" + num;
        };

    // Is space-mode rendering on:
    var starfieldActive = false;

    // Velocity config:
    var
        fbRiseRate = 0.1,
        playerGrav = 0.00075,
        coinRiseRate = 0.1,
        platfmRiseRate = 0.15,
        activePowerupTravelTime = 250,
        activePowerupLifespan = 10000;

    // Other numeric config:
    var
        fbRadius = 10,
        fbNumRecordedFrames = 300,
        fbCreationChanceFactor = 1 / 12250,
        coinRadius = 10,
        coinValue = 11,
        coinStartingY = gameHeight + coinRadius,
        totalFbHeight = 10,
        platfmThickness = 6,
        playerTorsoLen = 9.375,
        playerRadius = 7.5,
        playerHeadRadius = 5.625,
        playerElbowXDiff = 5,
        playerWheelToHeadDist = playerTorsoLen + playerRadius + playerHeadRadius,
        playerDuckingXDiff = -3,
        playerDuckingYDiff = -10,
        inGamePointsPxSize = 30,
        inGamePointsXPos = 16,
        inGamePointsYPos = 9,
        activePowerupsStartingXPos = gameWidth - 78,
        powerupBubbleRadius = 18,
        powerupCreationChanceFactor = 1 / 75000,
        powerupTotalLifespan = 5500, // in milliseconds
        powerupX2Width = 36,
        powerupX2Height = 23,
        powerupSlowRadius = 12,
        powerupMagnetRadius = 9,
        powerupMagnetThickness = 8,
        powerupWeightHandleHeight = 4,
        powerupWeightBlockUpperXMargin = 3,
        powerupWeightBlockLowerWidth = 30,
        powerupWeightBlockHeight = 20,
        powerupWeightHeight = powerupWeightBlockHeight + powerupWeightHandleHeight,
        btnShadowOffset = 2,
        maxFpsForSlowFrame = 40;

    // Button util and config:
    var
        mkBtn = function (data) {
            data.tintedRed = !!data.tintedRed;
            data.textWDiff = data.textWDiff || 0;
            data.textHDiff = data.textHDiff || 0;
            data.textXOffset = data.textXOffset || 0;
            // `textXOffset' is for small adjustments to alignment
            // which make the button text *appear* better centered

            data.edgeX = data.x - data.w / 2;

            return Object.freeze(data);
        },

        menuPlayBtn = mkBtn({
            text: "Play",
            font: "italic bold 53px font0",
            x: gameWidth / 2,
            y: 280,
            w: 121,
            h: 57,
            textHDiff: -13
        }),

        replayBtn = mkBtn({
            text: "Replay",
            font: "bold 33px font0",
            x: gameWidth / 2,
            y: 323,
            w: 110,
            h: 45,
            textHDiff: -12,
            textWDiff: -5,
            tintedRed: true
        }),

        resumeBtn = mkBtn({
            text: "Resume",
            font: "bold 30px font0",
            x: gameWidth / 2,
            y: replayBtn.y - 68,
            w: replayBtn.w + 9,
            h: replayBtn.h - 3,
            textXOffset: 1,
            textHDiff: -12,
            textWDiff: -5,
            tintedRed: true
        }),

        pauseBtn = (function () {
            var margin = 30;
            var s = 40;
            return mkBtn({
                text: ":pause",
                x: gameWidth - margin,
                y: margin - s / 2,
                w: s,
                h: s,
                textHDiff: -17
            });
        }()),

        touchIsInsideBtn = function (xy, btn) {
            var withinHeight = xy.y1 >= btn.y && xy.y1 <= btn.y + btn.h;
            var withinWidth = xy.x1 >= btn.edgeX && xy.x1 <= btn.edgeX + btn.w;
            return withinHeight && withinWidth;
        },

        touchIsInPauseBtn = function (xy) {
            // Checks whether a touch is above and to the right of the
            // bottom-left bound of the pause btn. A more inclusive and
            // useful test than whether the touch is exactly in the btn.
            return xy.y1 <= pauseBtn.y + pauseBtn.h &&
                    xy.x1 >= pauseBtn.edgeX;
        };

    // Highscore update and storage:
    var
        mkHighscores = function (identifier) {
            // In `scores', highest scores are at the beginning, `null'
            // represents an empty slot (when fewer than 3 games have
            // been played)
            // By default, `scores' is three empty slots
            var scores = [null, null, null];

            var fromLocal = localStorage.getItem(identifier);
            if (fromLocal !== null) {
                fromLocal = JSON.parse(fromLocal);
                if (fromLocal) {
                    // Update `scores' with the stored highscores
                    scores = fromLocal;
                }
            }

            return Object.freeze({
                each: function (f) {
                    scores.forEach(function (score) {
                        if (score !== null) {
                            f(score);
                        }
                    });
                },

                sendScore: function (score) {
                    var i, result = false;
                    for (i = 0; i < scores.length; i += 1) {
                        if (score > scores[i] || scores[i] === null) {
                            scores.splice(i, 0, score);
                            scores.splice(scores.length - 1, 1);
                            result = true;
                            break;
                        }
                    }
                    localStorage.setItem(identifier, JSON.stringify(scores));
                    return result;
                }
            });
        },
        highscores = mkHighscores("highscores");

    // Vector and line util:
    var Vector = Object.freeze({
        create: function (x, y) {
            return {vx: x, vy: y};
        },
        findMagnitude: function (vect) {
            return quickSqrt(vect.vx * vect.vx + vect.vy * vect.vy);
        },
        setMagnitude: function (vect, mag) {
            var angle = Math.atan2(vect.vy, vect.vx);
            vect.vx = trig.cos(angle) * mag;
            vect.vy = trig.sin(angle) * mag;
        }
    });

    var runLoop = (function () {
        var fallbackFps = 31;
        var mustFallback = false;

        // Run a game-loop with requestAnimationFrame (raf) to time ticks
        var rafLoop = function (tick, isLagTooGreat, handleDowngrade) {
            var deltas = [];
            var detlasMaxLength = 100;
            var prevTime = performance.now() - 20;
            var firstFrame = true;
            var stop = false;

            isLagTooGreat = isLagTooGreat || function () {
                return false;
            };

            requestAnimationFrame(function repeat(now) {
                if (stop) {
                    return;
                }

                requestAnimationFrame(repeat);

                if (!firstFrame && deltas.length < detlasMaxLength) {
                    deltas.push(now - prevTime);
                } else {
                    firstFrame = false;
                }

                stop = tick(now, true);
                if (deltas.length < detlasMaxLength
                        && isLagTooGreat(deltas)) {
                    stop = true;
                    mustFallback = true;
                    handleDowngrade(tick, fallbackFps);
                }
                prevTime = now;
            });

            return deltas;
        };

        // Run a game-loop with setInterval to time ticks
        var intervalLoop = function (tick, fps) {
            var deltas = [];
            var prevTime = performance.now() - 20;
            var firstFrame = true;

            var intervalId = setInterval(function () {
                var now = performance.now();
                if (!firstFrame) {
                    deltas.push(now - prevTime);
                } else {
                    firstFrame = true;
                }

                var stop = tick(now, false);
                if (stop) {
                    clearInterval(intervalId);
                }

                prevTime = now;
            }, 1000 / fps);

            return deltas;
        };

        var frameTooSlow = function (dt) {
            return 1000 / dt < maxFpsForSlowFrame;
        };
        var lagThresholdReached = function (deltas) {
            // TODO: Test more on Galaxy Note 3 and refine
            var lastFew = deltas.slice(-10);
            var numSlow = lastFew.filter(frameTooSlow).length;
            if (deltas.length <= 5) {
                if (numSlow >= 4) {
                    return true;
                }
            }
            return numSlow > 3;
        };

        return function (tick) {
            if (mustFallback) {
                intervalLoop(tick, fallbackFps);
            } else {
                rafLoop(tick, lagThresholdReached, intervalLoop);
            }
        };
    }());

    // Constructors for in-game objects:
    var
        createPlayer = function (x, y, vx, vy) {
            return {
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                wheelAngle: 0, // in degrees
                ducking: false
            };
        },

        createPlatfm = function (x0, y0, x1, y1) {
            return {
                x0: x0,
                y0: y0,
                x1: x1,
                y1: y1,
                time_left: 800,
                lengthSquared: distanceSquared(x0, y0, x1, y1),

                // `maybeGetPlatfmFromTouch' ensures that for all hand-drawn
                // platfms, platfm.x1 !== platfm.x0, so that the following
                // slope calculation does not blow up:
                slope: (y1 - y0) / (x1 - x0),
                bounceSpeedX: undefined,
                bounceVy: undefined,
                bounceSpeed: undefined
                // bounceSpeed is a cache of the magnitude of
                // the vector (bounceVx, bounceVy)
            };
        },

        createCoin = function (x, y, groupId) {
            return {x: x, y: y, groupId: groupId};
        },

        createFb = function (x, y) {
            return {x: x, y: y, frame: Math.floor(Math.random() * fbNumRecordedFrames)};
        },

        createPowerup = function (y, powerupType) {
            return {
                offsetY: y,
                lifetime: 0,
                type: powerupType
            };
        },

        calcPowerupXPos = function (powerup) {
            return powerup.lifetime / powerupTotalLifespan * gameWidth;
        },

        calcPowerupYPos = function (powerup) {
            // y position of a powerup is a sin function of its x
            // position, with stretched period and amplitude
            return powerup.offsetY + trig.sin(calcPowerupXPos(powerup) / 20) * 40;
        },

        createActivePowerup = function (type, srcX, srcY) {
            var lifetime = type === "slow"
                ? activePowerupLifespan * 2 / 3
                : activePowerupLifespan;
            return {
                type: type,
                totalLifetime: lifetime,
                lifetime: lifetime,
                srcX: srcX,
                srcY: srcY,
                timeSinceAcquired: 0
            };
        },

        createGame = function () {
            return {
                player: createPlayer(gameWidth / 2, 50, 0, 0),

                platfms: [],

                // `previewPlatfmTouch' holds the current touch object, if a
                // platfm is being drawn. Otherwise, it holds `null'
                previewPlatfmTouch: null,

                // 'fb' is short for 'fireball'
                fbs: [],

                coins: [],

                // `game.coinGroups[i]` holds the number of still-living
                // coins in the coinGroup with ID `i'
                coinGroups: {},

                // The id to use for the next coin group:
                nextCoinGroupId: 0,

                // `game.coinGroupBonuses[i]` holds the extra points to be
                // gained once the every coin in group `i' has been obtained
                coinGroupBonuses: {},

                // Holds the current on-screen congratulatory notifications:
                coinGroupGottenNotifs: [],

                coinReleaseMode: "random",

                // In "random" coin mode, whether to switch modes is determined
                // randomly, without a timeout, so the following is `null'
                coinReleaseModeTimeLeft: null,

                // `coinGridOffset' is explained in detail in
                // the `gUpdaters.coins' function
                coinGridOffset: 0,

                powerups: {},

                activePowerups: [],

                points: 0,
                // How many of those points were gotten from coins directly:
                pointsFromCoins: 0,
                // `pointsFromCoins' is kept track of because the difficulty
                // curve is a function of points not gotten from coins directly

                paused: false,
                dead: false,

                // Is the pause button currently drawn in the pressed position?
                pauseBtnDown: false,

                // For debugging
                statsPrev: {},
                stats: {}
            };
        };

    // Rendering:
    var Render = (function () {
        var bgCtx = bgCanvas.getContext("2d");
        var mainCtx = mainCanvas.getContext("2d");
        var btnCtx = btnCanvas.getContext("2d");
        var overlayCtx = overlayCanvas.getContext("2d");

        bgCtx.scale(pageScaleFactor, pageScaleFactor);
        mainCtx.scale(pageScaleFactor, pageScaleFactor);
        btnCtx.scale(pageScaleFactor, pageScaleFactor);
        overlayCtx.scale(pageScaleFactor, pageScaleFactor);
        // The following translations are a trick to make lines sharper:
        // (No translation on bgCtx because clouds benefit
        // from extra bluriness, and stars are unaffected.)
        mainCtx.translate(0.5, 0.5);
        btnCtx.translate(0.5, 0.5);
        overlayCtx.translate(0.5, 0.5);

        // For caching drawings on an off-screen canvas:
        var offScreenRender = function (width, height, render) {
            var newCanvas = document.createElement('canvas');
            newCanvas.width = width;
            newCanvas.height = height;
            var ctx = newCanvas.getContext('2d');
            ctx.translate(0.5, 0.5);
            render(ctx, width, height);
            return newCanvas;
        };

        // Renderers:
        var
            fillShadowyText = function (ctx, text, x, y, reverse, offsetAmt, w, h) {
                // Doesn't set things like ctx.font and ctx.textAlign so that they
                // can be set on ctx by the caller, before invoking.
                var neutralClr = starfieldActive ? "white" : "black";
                var brightClr = starfieldActive ? "royalblue" : "darkOrange";
                var clr0 = reverse ? neutralClr : brightClr;
                var clr1 = reverse ? brightClr : neutralClr;
                var offset = offsetAmt || 1;
                var setW = w !== undefined;
                ctx.fillStyle = clr0;
                if (setW) {
                    ctx.fillText(text, x, y, w, h);
                } else {
                    ctx.fillText(text, x, y);
                }
                ctx.fillStyle = clr1;
                if (setW) {
                    ctx.fillText(text, x + offset, y - offset, w, h);
                } else {
                    ctx.fillText(text, x + offset, y - offset);
                }
            },

            drawCircle = function (ctx, x, y, radius, color, fillOrStroke) {
                ctx.beginPath();
                ctx[fillOrStroke + "Style"] = color;
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                ctx[fillOrStroke]();
            },

            circleAt = function (ctx, x, y, radius) {
                // The `+ radius' in the `moveTo' call below prevents a line
                // from being drawn from the edge of the circle to its center
                ctx.moveTo(x + radius, y);
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
            },

            lineFromTo = function (ctx, x0, y0, x1, y1) {
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
            },

            drawPlayerDuckingAt = (function () {
                var w = playerRadius * 3;
                var h = playerRadius * 3 + 6;
                var hToWheelCenter = h - 3 - playerRadius;

                var forClouds = new Image();
                forClouds.src = "img/player-ducking-spritesheet_clouds.png";
                var forStars = new Image();
                forStars.src = "img/player-ducking-spritesheet_stars.png";

                return function (ctx, x, y, wheelAngle) {
                    var sourceX = modulo(Math.trunc(wheelAngle), 60) * w - w / 2;
                    ctx.drawImage(
                        starfieldActive ? forStars : forClouds,
                        // source x, y:
                        sourceX, hToWheelCenter,
                        w, h,
                        // target x, y (position to draw in `ctx'):
                        x - w / 2, y - hToWheelCenter,
                        w, h
                    );
                };
            }()),

            drawPlayerAt = (function () {
                var w = 4 * playerElbowXDiff + 4 + 1;
                var h = 42;
                var hToWheelCenter = playerHeadRadius * 2 + playerTorsoLen + playerRadius + 3;

                var forClouds = new Image();
                forClouds.src = "img/player-spritesheet_clouds.png";
                var forStars = new Image();
                forStars.src = "img/player-spritesheet_stars.png";

                return function (ctx, x, y, wheelAngle) {
                    var sourceX = modulo(Math.trunc(wheelAngle), 60) * w;
                    ctx.drawImage(
                        starfieldActive ? forStars : forClouds,
                        // source x, y:
                        sourceX, 0,
                        w, h,
                        // target x, y (position to draw in `ctx'):
                        x - w / 2, y - hToWheelCenter,
                        w, h
                    );
                };
            }()),

            drawFb = (function () {
                // Dimensions occupied by each frame in img/fb-frames.png
                var w = 30;
                var h = 70;

                // Distance to center from top edge and left edge of sprite:
                var radiusToCenter = w / 2;

                var frames = new Image();
                frames.src = "img/fb-frames.png";

                return function (ctx, fb) {
                    var i = fb.frame % fbNumRecordedFrames;
                    ctx.drawImage(
                        frames, // source image
                        i * w, // source x
                        0, // source y
                        w,
                        h,
                        fb.x - radiusToCenter, // target x
                        fb.y - radiusToCenter, // target y
                        w,
                        h
                    );
                };
            }()),

            drawCoin = (function () {
                var s = coinRadius * 2.5; // width and height of png sprites

                var gold = new Image();
                gold.src = "img/coin_clouds.png";

                var green = new Image();
                green.src = "img/coin_stars.png";

                return function (ctx, coin) {
                    ctx.drawImage(starfieldActive ? green : gold, coin.x - s / 2, coin.y - s / 2);
                };
            }()),

            drawCoinGroupGottenNotif = (function () {
                var notif = document.createElement("canvas");
                var pxSize = 18;
                notif.width = pxSize * 4;
                notif.height = pxSize * 1.5;

                // Some constants:
                var message = "100%";
                var clrOuter = "#DD0B11";
                var clrInner = "#ECB435";
                var innerX = 8;
                var innerY = 20;
                var ctx = notif.getContext("2d");

                // Set up styling of first text-draw immediately:
                ctx.lineWidth = 6;
                ctx.strokeStyle = clrOuter;

                // Wait for onload to ensure that the correct font has loaded:
                window.addEventListener("load", function () {
                    ctx.font = "italic " + pxSize + "px font0";

                    ctx.strokeText(message, innerX, innerY);

                    ctx.lineWidth = 4;
                    ctx.strokeStyle = clrInner;
                    ctx.strokeText(message, innerX, innerY);
                }, false);

                return function (ctx, x, y) {
                    ctx.drawImage(notif, x, y);
                };
            }()),

            setupGenericPlatfmChars = function (ctx) {
                ctx.strokeStyle = starfieldActive ? "white" : "black";
                ctx.lineWidth = platfmThickness;
                ctx.lineCap = "round";
                ctx.lineJoin = "smooth";
            },

            drawPlatfm = function (ctx, p) { // Must be run after setupGenericPlatfmChars
                ctx.beginPath();
                if (starfieldActive) {
                    ctx.globalAlpha = Math.max(0, Math.min(400, p.time_left) / 400);
                } else {
                    ctx.globalAlpha = Math.max(0, p.time_left / 1000);
                }
                ctx.moveTo(p.x0, p.y0);
                ctx.lineTo(p.x1, p.y1);
                ctx.stroke();
            },

            drawPreviewPlatfm = function (ctx, touch) { // Must be run after setupGenericPlatfmChars
                ctx.beginPath();
                ctx.strokeStyle = starfieldActive ? "white" : "grey";
                ctx.moveTo(touch.x0, touch.y0);
                ctx.lineTo(touch.x1, touch.y1);
                ctx.stroke();
            },

            updateInGamePointsDisplay = (function () {
                // Clear the canvas in the area taken up by the least
                // significant digits of the player's points-display
                // and draw over that area the new least significant
                // digits of the player's points. Redraws as few
                // digits as possible--usually only one digit or none.

                // Get png images for each digit 0-9:
                var i;
                var digits = [];
                for (i = 0; i < 10; i += 1) {
                    digits[i] = new Image();
                    digits[i].src = "img/scores/score-" + i + ".png";
                }
                Object.freeze(digits);

                // `digitWidths[i]' is the width allocated to `i' as a
                // score digit when drawn below
                var digitWidths = Object.freeze([
                    19, 13, 17, 17, 17, 18, 17, 16, 17, 17
                ]);

                var drawScoreDigitsAt = function (ctx, scoreStr, startX) {
                    // Clear the digit space in which we'll draw `scoreStr':
                    ctx.clearRect(
                        startX,
                        inGamePointsYPos,
                        pauseBtn.edgeX - startX - 5,
                        inGamePointsPxSize
                    );

                    // Draw in the new digits (i.e. `scoreStr'):
                    var i;
                    var digitX = startX;
                    for (i = 0; i < scoreStr.length; i += 1) {
                        ctx.drawImage(digits[scoreStr[i]], digitX, inGamePointsYPos);
                        digitX += digitWidths[scoreStr[i]];
                    }
                };

                return function (ctx, game) {
                    var sPrev = "" + Math.floor(game.prevPoints);
                    var sNow = "" + Math.floor(game.points);

                    if (sNow === sPrev) {
                        return;
                    }

                    var i;
                    var x = inGamePointsXPos;
                    for (i = 0; i < sNow.length; i += 1) {
                        if (sNow[i] !== sPrev[i]) {
                            return drawScoreDigitsAt(ctx, sNow.slice(i), x);
                        }
                        x += digitWidths[sNow[i]];
                    }
                };
            }()),

            drawPowerupBubble = function (ctx, x, y) {
                ctx.beginPath();
                circleAt(ctx, x, y, powerupBubbleRadius);
                ctx.fillStyle = "rgba(255, 215, 0, 0.35)";
                ctx.fill();
            },

            drawPowerup = (function () {
                var canvases = {
                    "X2": offScreenRender(powerupX2Width, powerupX2Height, function (ctx, w, h) {
                        ctx.fillStyle = "gold";
                        ctx.textAlign = "left";
                        ctx.font = "bold italic 22px arial";
                        ctx.lineWidth = 1;
                        ctx.fillText("X2", 5, h * 0.82, w, h);
                        ctx.strokeStyle = "orange";
                        ctx.strokeText("X2", 5, h * 0.82, w, h);
                    }),

                    "slow": offScreenRender(powerupSlowRadius * 2 + 5, powerupSlowRadius * 2 + 5, function (ctx, w, h) {
                        var cx = w / 2, cy = h / 2;
                        ctx.lineWidth = 2;
                        drawCircle(ctx, cx, cy, powerupSlowRadius, "black", "stroke");
                        drawCircle(ctx, cx, cy, powerupSlowRadius, "white", "fill");

                        // Hour hand
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        lineFromTo(ctx, cx, cy, cx + powerupSlowRadius * 0.7, cy);
                        ctx.stroke();

                        // 12 tick marks
                        var i, angle, cos, sin;
                        var tickOuterR = powerupSlowRadius * 0.85;
                        var tickInnerR = powerupSlowRadius * 0.8;
                        ctx.beginPath();
                        for (i = 0; i < 12; i += 1) {
                            angle = Math.PI * 2 * (i / 12);
                            cos = trig.cos(angle);
                            sin = trig.sin(angle);
                            lineFromTo(
                                ctx,
                                cx + cos * tickOuterR,
                                cy + sin * tickOuterR,
                                cx + cos * tickInnerR,
                                cy + sin * tickInnerR
                            );
                        }
                        ctx.stroke();

                        // Second hand
                        ctx.beginPath();
                        lineFromTo(ctx, cx, cy, cx, cy - powerupSlowRadius * 0.95);
                        ctx.strokeStyle = "red";
                        ctx.stroke();
                    }),

                    "weight": offScreenRender(powerupWeightBlockLowerWidth, powerupWeightHeight, function (ctx, w, fullHeight) {
                        var cx = w / 2;
                        var blockHeight = powerupWeightBlockHeight;
                        var handleHeight = powerupWeightHandleHeight;

                        // Solid black block:
                        ctx.beginPath();
                        ctx.moveTo(powerupWeightBlockUpperXMargin, handleHeight);
                        ctx.lineTo(w - powerupWeightBlockUpperXMargin, handleHeight);
                        ctx.lineTo(w, handleHeight + blockHeight - 2);
                        ctx.lineTo(0, fullHeight - 2);
                        ctx.fillStyle = "black";
                        ctx.fill();

                        // Weight handle:
                        ctx.beginPath();
                        ctx.moveTo(cx - 8, handleHeight);
                        ctx.lineTo(cx - 5, 0);
                        ctx.lineTo(cx + 5, 0);
                        ctx.lineTo(cx + 8, handleHeight);
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "black";
                        ctx.stroke();

                        // '1000' weight marker:
                        ctx.font = "bold 26px Courier New";
                        ctx.fillStyle = "lightGrey";
                        ctx.textAlign = "center";
                        ctx.fillText("1000", cx, fullHeight - 3, 24);
                    }),

                    "magnet": offScreenRender(powerupMagnetRadius * 3, powerupMagnetRadius * 3, function (ctx, w, h) {
                        var x = w / 2, y = h / 2;
                        var thick = powerupMagnetThickness;
                        ctx.beginPath();
                        ctx.arc(x, y, powerupMagnetRadius, 0, Math.PI, true);
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = powerupMagnetThickness;
                        ctx.stroke();
                        ctx.fillStyle = "red";
                        ctx.fillRect(x - powerupMagnetRadius - thick / 2, y - 1, thick, thick / 2 + 1);
                        ctx.fillRect(x + powerupMagnetRadius - thick / 2, y - 1, thick, thick / 2 + 1);
                        ctx.fillStyle = "white";
                        ctx.fillRect(x - powerupMagnetRadius - thick / 2, y + thick / 2 - 1, thick, thick / 2 + 2);
                        ctx.fillRect(x + powerupMagnetRadius - thick / 2, y + thick / 2 - 1, thick, thick / 2 + 2);
                    })
                };

                return function (ctx, type, x, y) {
                    var canvas = canvases[type];
                    if (type === "weight") {
                        y -= 1;
                    }
                    ctx.drawImage(canvas, x - canvas.width / 2 - 0.5, y - canvas.height / 2 - 0.5);
                };
            }()),

            drawActivePowerupBackground = function (ctx, lifeleft, totalLifetime, x, y) {
                if (lifeleft <= 0) {
                    return;
                }
                var fractionLifeLeft = lifeleft / totalLifetime;
                var nearDeath = fractionLifeLeft < 0.25;

                // Round the progress of the time-left arc to give a
                // ticking motion.
                // When closer to dying, the ticking happens faster,
                // so `roundedFrac' must be rounded to higher precision:
                var roundAmt = nearDeath ? 120 : 60;
                // Fraction of the circle to be darker:
                var roundedFrac = Math.ceil(fractionLifeLeft * roundAmt) / roundAmt;
                var angleOfGrayArc = 2 * Math.PI * roundedFrac;

                // Fill a fraction of the circle with dark gray (or red);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, powerupBubbleRadius, 0, angleOfGrayArc, false);
                ctx.fillStyle = nearDeath ? "rgba(200, 0, 0, 1)" : "rgba(150, 150, 150, 0.65)";
                ctx.fill();

                // Fill the rest of the circle with a ghosted background gray:
                if (angleOfGrayArc < 2 * Math.PI) {
                    // This condition can fail due to rounding in `roundedFrac'

                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.arc(x, y, powerupBubbleRadius, 0, angleOfGrayArc, true);
                    ctx.fillStyle = "rgba(150, 150, 150, 0.25)";
                    ctx.fill();
                }
            },

            drawActivePowerups = function (ctx, actives) {
                var xPos = activePowerupsStartingXPos;
                var yPos = inGamePointsYPos + 21;
                var i;
                var tempX, tempY;
                for (i = 0; i < actives.length; i += 1) { // Start with the last activepowerups, which have been around the longest.
                    if (actives[i].timeSinceAcquired < activePowerupTravelTime) {
                        tempX = (actives[i].timeSinceAcquired / activePowerupTravelTime) * (xPos - actives[i].srcX) + actives[i].srcX;
                        tempY = (actives[i].timeSinceAcquired / activePowerupTravelTime) * (yPos - actives[i].srcY) + actives[i].srcY;
                        drawActivePowerupBackground(ctx, actives[i].lifetime, actives[i].totalLifetime, tempX, tempY);
                        drawPowerup(ctx, actives[i].type, tempX, tempY);
                    } else {
                        drawActivePowerupBackground(ctx, actives[i].lifetime, actives[i].totalLifetime, xPos, yPos);
                        drawPowerup(ctx, actives[i].type, xPos, yPos);
                        xPos -= 2.1 * powerupBubbleRadius;
                    }
                }
            },

            drawMenuTitle = function (ctx) {
                ctx.font = "italic bold 170px arial";
                ctx.textAlign = "center";
                fillShadowyText(ctx, "Fire", gameWidth / 2 - 3, 190, true, 3);
                ctx.font = "italic bold 95px arial";
                fillShadowyText(ctx, "cyclist", gameWidth / 2 - 3, 240, true, 2);
            },

            drawRoundedRectPath = function (ctx, x, y, width, height, radius) {
                // Thank you, Juan Mendes (function from <http://js-bits.blogspot.com/2010/07/canvas-rounded-corner-rectangles.html>, with slight modification).
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
            },

            drawRoundedRect = function (ctx, x, y, width, height, radius, style) {
                ctx.beginPath();
                drawRoundedRectPath(ctx, x, y, width, height, radius, style);
                ctx[style]();
            },

            drawButtonStructureAt = (function () {
                var stdClrs = {
                    shadow: "rgba(130, 150, 170, 0.7)",
                    btn: "rgb(145, 183, 200)"
                };
                var tintedClrs = {
                    shadow: "rgba(178, 148, 138, 0.7)",
                    btn: "rgb(215, 188, 173)"
                };
                var starfieldClrs = {
                    shadow: "rgb(0, 0, 50)",
                    btn: "darkblue"
                };
                return function (ctx, edgeX, edgeY, width, height, pressed, reddish, radius) {
                    var clrs = stdClrs;
                    if (starfieldActive) {
                        clrs = starfieldClrs;
                    } else if (reddish) {
                        clrs = tintedClrs;
                    }
                    radius = radius || 8;
                    if (pressed) {
                        ctx.fillStyle = clrs.btn;
                        drawRoundedRect(ctx, edgeX - btnShadowOffset, edgeY + btnShadowOffset, width, height, radius, "fill");
                    } else {
                        ctx.fillStyle = clrs.shadow;
                        drawRoundedRect(ctx, edgeX - btnShadowOffset, edgeY + btnShadowOffset, width, height, radius, "fill");
                        ctx.fillStyle = clrs.btn;
                        drawRoundedRect(ctx, edgeX, edgeY, width, height, radius, "fill");
                    }
                };
            }()),

            drawPauseBars = function (ctx, offsetX, y, btn) {
                var leftX = btn.edgeX + offsetX + 9 + btn.textXOffset;
                var barsY = y + 9;
                var barW = btn.w / 4 - 2 + btn.textWDiff;
                var barH = btn.h + btn.textHDiff;
                ctx.beginPath();
                ctx.rect(leftX, barsY, barW, barH);
                ctx.rect(leftX + barW * 5 / 3, barsY, barW, barH);
                ctx.fill();
            },

            drawBtn = function (ctx, btn) {
                // Draw the button `ctx', and return a boolean representing if
                // the button was drawn impressed.

                var pressed = Touch.curTouch && touchIsInsideBtn(Touch.curTouch, btn);

                // Draw visual structure of button (shapes behind the label):
                drawButtonStructureAt(ctx, btn.edgeX, btn.y, btn.w, btn.h, pressed, btn.tintedRed);

                var x = btn.x;
                var y = btn.y;

                if (pressed) {
                    x -= btnShadowOffset;
                    y += btnShadowOffset;
                }

                // Set color to use for button label:
                ctx.fillStyle =
                    starfieldActive ? "royalblue" :
                    btn.tintedRed ? "rgb(175, 145, 125)" :
                    "rgb(120, 135, 130)";

                // Draw button label with that color:
                if (btn.text === ":pause") {
                    drawPauseBars(ctx, pressed ? -btnShadowOffset : 0, y, btn);
                } else {
                    ctx.font = btn.font;
                    ctx.textAlign = "center";
                    ctx.fillText(btn.text, x + btn.textXOffset, y + btn.h + btn.textHDiff, btn.w + btn.textWDiff, btn.h + btn.textHDiff);
                }

                return pressed;
            },

            clearPauseBtn = function () {
                btnCtx.clearRect(
                    pauseBtn.edgeX - btnShadowOffset,
                    0,
                    gameWidth - (pauseBtn.edgeX - btnShadowOffset),
                    pauseBtn.y + pauseBtn.h + btnShadowOffset
                );
            },

            redrawPauseBtn = function (game) {
                clearPauseBtn();
                game.pauseBtnDown = drawBtn(btnCtx, pauseBtn);
            },

            drawMovingBg = (function () {
                var bgsWidth = 864;
                var bgsHeight = 1024;
                var cloudsSelected;
                // `cloudsSelected' is true when `bgCtx.fillStyle' is set
                // to `cloudPattern', and false when it is set to `starPattern'

                // Set up cloud background image
                var cloudImg = new Image(), cloudPattern;
                cloudImg.onload = function () {
                    cloudPattern = bgCtx.createPattern(cloudImg, "repeat");
                    bgCtx.fillStyle = cloudPattern;
                    cloudsSelected = true;
                };
                cloudImg.src = "img/bg-clouds-20-blurs.png";

                // Set up star background image
                var starImg = new Image(), starPattern;
                starImg.onload = function () {
                    starPattern = bgCtx.createPattern(starImg, "repeat");
                };
                starImg.src = "img/bg-star-field.png";

                // `xOffset' and `yOffset' record how far the background
                // has visually drifted
                var xOffset = 0, yOffset = 0;
                return function (doMovement) {
                    // Make the background wrap around
                    xOffset = modulo(xOffset, bgsWidth);
                    yOffset = modulo(yOffset, bgsHeight);

                    // Change the background image to be used, if necessary
                    if (cloudsSelected && starfieldActive) {
                        cloudsSelected = false;
                        bgCtx.fillStyle = starPattern;
                    } else if (!cloudsSelected && !starfieldActive) {
                        cloudsSelected = true;
                        bgCtx.fillStyle = cloudPattern;
                    }

                    // Draw the background
                    if (cloudPattern && starPattern) {
                        // The following state changes feel wasteful, but
                        // are safe and don't seem to show up in profiles
                        bgCtx.save();
                        bgCtx.translate(-xOffset, -yOffset);
                        bgCtx.fillRect(0, 0, gameWidth * 6, gameHeight * 4);
                        bgCtx.restore();
                        if (doMovement) {
                            xOffset += 0.115;
                            yOffset += 0.021;
                        }
                    }
                };
            }()),

            drawMenu = function (menu) {
                mainCtx.clearRect(-1, -1, gameWidth + 1, gameHeight + 1);
                menu.fbs.forEach(function (fb) {
                    drawFb(mainCtx, fb);
                });
                drawMenuTitle(mainCtx);
                drawBtn(mainCtx, menuPlayBtn);
            },

            drawGame = function (game) {
                var i, val;
                mainCtx.save();
                mainCtx.clearRect(-1, -1, gameWidth + 1, gameHeight + 1);
                overlayCtx.clearRect(-1, -1, gameWidth + 1, gameHeight + 1);

                // Player
                if (game.player.ducking) {
                    drawPlayerDuckingAt(mainCtx, game.player.x, game.player.y, game.player.wheelAngle);
                } else {
                    drawPlayerAt(mainCtx, game.player.x, game.player.y, game.player.wheelAngle);
                }

                // Platfms
                setupGenericPlatfmChars(mainCtx);
                for (i = 0; i < game.platfms.length; i += 1) {
                    drawPlatfm(mainCtx, game.platfms[i]);
                }
                mainCtx.globalAlpha = 1; // Changed in platfm drawing, so must be reset
                if (game.previewPlatfmTouch) {
                    drawPreviewPlatfm(mainCtx, game.previewPlatfmTouch);
                }

                // Other moving screen elements
                for (i = 0; i < game.coins.length; i += 1) {
                    val = game.coins[i];
                    if (val.y < gameHeight + coinRadius) {
                        drawCoin(mainCtx, val);
                    }
                }
                for (i = 0; i < game.coinGroupGottenNotifs.length; i += 1) {
                    val = game.coinGroupGottenNotifs[i];
                    drawCoinGroupGottenNotif(mainCtx, val.x, val.y);
                }
                for (i = 0; i < game.fbs.length; i += 1) {
                    drawFb(mainCtx, game.fbs[i]);
                }

                // Powerups
                forEachInObject(game.powerups, function (pname, powerup) {
                    var x = calcPowerupXPos(powerup);
                    var y = calcPowerupYPos(powerup);
                    drawPowerupBubble(mainCtx, x, y);
                    drawPowerup(mainCtx, powerup.type, x, y);
                });
                drawActivePowerups(mainCtx, game.activePowerups);

                // Points
                updateInGamePointsDisplay(btnCtx, game);

                mainCtx.restore();
            },

            drawTutorialHand = (function () {
                var handClouds = new Image();
                handClouds.src = "img/hand-on-blue.png";
                var handStars = new Image();
                handStars.src = "img/hand-on-black.png";
                return function (ctx, x, y) {
                    ctx.drawImage(starfieldActive ? handStars : handClouds, x, y);
                };
            }()),

            drawSwipeHelpText = (function () {
                var lines = ["Swipe to draw", "platforms"];
                var pxSize = 25;
                var drawIt = function (ctx, x, y) {
                    ctx.textAlign = "center";
                    ctx.font = "italic " + pxSize + "px font0";
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = "tan";
                    ctx.strokeText(lines[0], x, y);
                    ctx.strokeText(lines[1], x, y + pxSize);
                    ctx.fillStyle = "brown";
                    ctx.fillText(lines[0], x, y);
                    ctx.fillText(lines[1], x, y + pxSize);
                };

                var w = 164, h = 58;
                var xrad = 81, yrad = 23;

                var helpTextCanvas = offScreenRender(w, h, function (ctx) {
                    drawIt(ctx, xrad, yrad);
                });

                var helpTextImage = new Image();
                helpTextImage.src = "img/tutorial-text_clouds.png";
                var imageLoaded = false;
                helpTextImage.addEventListener("load", function () {
                    imageLoaded = true;
                });

                return function (ctx, x, y) {
                    // The fallback to `helpTextCanvas' is necessary, as the
                    // user may press 'Play' (starting the tutorial) very
                    // quickly, before the image has loaded.
                    var toDraw = imageLoaded
                        ? helpTextImage
                        : helpTextCanvas;
                    ctx.drawImage(toDraw, x - xrad, y - yrad);
                };
            }()),

            drawTutorial = function (game, handX, handY) {
                mainCtx.save();
                mainCtx.clearRect(-1, -1, gameWidth + 1, gameHeight + 1);
                overlayCtx.clearRect(-1, -1, gameWidth + 1, gameHeight + 1);
                if (game.player.ducking) {
                    drawPlayerDuckingAt(mainCtx, game.player.x, game.player.y, game.player.wheelAngle);
                } else {
                    drawPlayerAt(mainCtx, game.player.x, game.player.y, game.player.wheelAngle);
                }
                setupGenericPlatfmChars(mainCtx);
                game.platfms.forEach(function (platfm) {
                    drawPlatfm(mainCtx, platfm);
                });
                mainCtx.globalAlpha = 1; // Changed in platfm drawing, so must be reset
                if (game.previewPlatfmTouch) {
                    drawPreviewPlatfm(mainCtx, game.previewPlatfmTouch);
                }
                drawTutorialHand(mainCtx, handX, handY);
                drawSwipeHelpText(mainCtx, gameWidth / 2, 350);
                mainCtx.restore();
            },

            gameOverlayDrawer = (function () {
                var vagueify = function (ctx) {
                    ctx.fillStyle = starfieldActive ? "rgba(0, 0, 0, 0.8)" : "rgba(200, 200, 200, 0.75)";
                    ctx.fillRect(-1, -1, gameWidth + 1, gameHeight + 1);
                };

                return function (drawFn) {
                    return function (game) {
                        drawGame(game);
                        overlayCtx.save();
                        vagueify(overlayCtx);
                        drawFn(overlayCtx, game);
                        overlayCtx.restore();
                    };
                };
            }()),

            drawGamePaused = gameOverlayDrawer(function (ctx) {
                ctx.fillStyle = starfieldActive ? "royalblue" : "darkOrange";
                ctx.font = "64px font0";
                ctx.textAlign = "center";
                ctx.fillText("Paused", gameWidth / 2, gameHeight / 2 - 28);
                drawBtn(ctx, resumeBtn);
            }),

            drawGameDead = gameOverlayDrawer(function (ctx, game) {
                var startY = 105;

                // 'Game Over' text
                ctx.fillStyle = starfieldActive ? "royalblue" : "darkOrange";
                ctx.font = "bold italic 90px font0";
                ctx.textAlign = "center";
                ctx.fillText("Game", gameWidth / 2 - 4, startY);
                ctx.fillText("Over", gameWidth / 2 - 4, startY + 75);

                // Points big
                ctx.font = "140px font0";
                ctx.fillText(Math.floor(game.points), gameWidth / 2, gameHeight * 2 / 3 - 38);

                startY += 18;

                // Line separator
                ctx.beginPath();
                ctx.strokeStyle = starfieldActive ? "royalblue" : "darkOrange";
                ctx.moveTo(30, startY + 260);
                ctx.lineTo(gameWidth - 30, startY + 260);
                ctx.moveTo(30, startY + 262);
                ctx.lineTo(gameWidth - 30, startY + 262);
                ctx.stroke();

                // Highscores
                ctx.font = "bold italic 28px font0";
                ctx.fillText("Highscores", gameWidth / 2, startY + 300);
                var scoreFontSize = 24;
                ctx.font = scoreFontSize + "px font0";
                var curY = startY + 325;
                highscores.each(function (score) {
                    ctx.fillText(score, gameWidth / 2, curY);
                    curY += scoreFontSize + 2;
                });

                // Replay btn
                drawBtn(ctx, replayBtn);
            });

        return Object.freeze({
            menu: drawMenu,
            game: drawGame,
            gamePaused: drawGamePaused,
            gameDead: drawGameDead,
            clearPauseBtn: clearPauseBtn,
            pauseBtn: redrawPauseBtn,
            tutorial: drawTutorial,
            background: drawMovingBg
        });
    }());

    // Handle device events:
    var setCurGame = (function () {
        var curGame = null;
        document.addEventListener("load", function () {
            document.addEventListener("deviceready", function () {
                document.addEventListener("pause", function () {
                    localStorage.setItem("halted_game", JSON.stringify(curGame));
                }, false);
                document.addEventListener("resume", function () {
                    var storedGameText = localStorage.getItem("halted_game");
                    if (typeof storedGameText === "string") {
                        var storedGame = JSON.parse(storedGameText);
                        storedGame.paused = true;
                        play(storedGame);
                    }
                }, false);
            });
        });
        return function (game) {
            curGame = game;
        };
    }());

    // Collision predicates:
    var Collision = Object.freeze({
        player_platfm: function (player, platfm) {
            // Make sure that the ball is in the square who's opposite
            // corners are the endpoints of the platfm. Necessary because
            // the algorithm for testing intersection used below is made
            // for (infinite) lines, not line segments, which the platfm is.
            var rad = playerRadius + platfmThickness,
                startx = Math.min(platfm.x0, platfm.x1),
                starty = Math.min(platfm.y0, platfm.y1),
                endx = Math.max(platfm.x0, platfm.x1),
                endy = Math.max(platfm.y0, platfm.y1);
            if (player.y + rad < starty || player.y > endy || player.x + rad < startx || player.x - rad > endx) {
                return false;
            }
            // Algorithm adapted from http://mathworld.wolfram.com/Circle-LineIntersection.html
            var lengthSquared = platfm.lengthSquared || distanceSquared(platfm.x0, platfm.y0, platfm.x1, platfm.y1);
            return Math.pow(rad, 2) * lengthSquared >= Math.pow((platfm.x0 - player.x) * (platfm.y1 - player.y) - (platfm.x1 - player.x) * (platfm.y0 - player.y), 2);
        },
        playerWheel_circle: function (player, x, y, circleRadius) {
            return distLT(player.x, player.y, x, y, playerRadius + circleRadius);
        },
        player_circle: function (player, x, y, circleRadius) {
            return Collision.playerWheel_circle(player, x, y, circleRadius) ||
                    (!player.ducking && distLT(player.x, player.y - playerWheelToHeadDist, x, y, playerHeadRadius + circleRadius));
        },
        playerHead_circle: function (player, x, y, circleRadius) {
            var headX, headY;
            if (player.ducking) {
                headX = player.x + playerDuckingXDiff;
                headY = player.y + playerDuckingYDiff;
            } else {
                headX = player.x;
                headY = player.y - playerWheelToHeadDist;
            }
            return distLT(headX, headY, x, y, playerHeadRadius + circleRadius);
        },
        playerTorso_circle: function (player, x, y, circleRadius) {
            var approxRadius = playerTorsoLen * 0.4;
            var cy = player.y - playerTorsoLen * 0.8;
            return distLT(player.x, cy, x, y, approxRadius + circleRadius);
        },
        playerHeadNearFb: function (player, fb) {
            var headWithMargin = playerHeadRadius + 10;
            // Add a margin of 10 so he ducks a little early.
            return distLT(player.x, player.y - playerWheelToHeadDist, fb.x, fb.y, headWithMargin + fbRadius);
        },
        player_fb: function (player, fb) {
            return Collision.playerHead_circle(player, fb.x, fb.y, fbRadius) ||
                    Collision.playerTorso_circle(player, fb.x, fb.y, fbRadius);
        },
        player_coin: function (player, coin) {
            return Collision.player_circle(player, coin.x, coin.y, coinRadius);
        },
        player_powerup: function (player, powerup) {
            return Collision.player_circle(
                player,
                calcPowerupXPos(powerup),
                calcPowerupYPos(powerup),
                powerupBubbleRadius
            );
        }
    });

    // Other small gameplay functions:
    var
        maybeGetPlatfmFromTouch = function (touch, success) {
            var tx0 = touch.x0;
            if (Touch.zeroLength(touch)) {
                return;
                // If its length is zero, (1) the user tapped and did not
                // mean to draw a platfm, and (2) it will cause NaN to
                // spread in the data.
            }
            if (touch.x0 === touch.x1) {
                tx0 -= 1;
                // Prevents problems which arise when line is exactly vertical.
            }
            success(createPlatfm(tx0, touch.y0, touch.x1, touch.y1));
        },

        randomXPosition = function () {
            return Math.random() * gameWidth;
        },

        updateFbsGeneric = (function () {
            var fewInLowerPortion = function (fbs) {
                // Predicate asks: are there few enough fbs in bottom
                // of screen that more must be made?
                var i, fb;
                for (i = 0; i < fbs.length; i += 1) {
                    fb = fbs[i];
                    if (fb.y > gameHeight * 3 / 4) {
                        return false;
                    }
                }
                return true;
            };
            return function (obj, dt) {
                // Can be passed a menu object or game object, and
                // thus is not directly placed in gUpdaters.
                var i, fb;
                for (i = 0; i < obj.fbs.length; i += 1) {
                    fb = obj.fbs[i];

                    fb.y -= fbRiseRate * dt;

                    if (fb.y < -totalFbHeight - 20) {
                        obj.fbs.splice(i, 1);
                    }

                    fb.frame = (fb.frame + 1) % fbNumRecordedFrames;
                }
                if (Math.random() < fbCreationChanceFactor * dt || fewInLowerPortion(obj.fbs)) {
                    obj.fbs.push(createFb(
                        randomXPosition(),
                        gameHeight + fbRadius
                    ));
                }
            };
        }()),

        powerupObtained = function (activePowerups, type) {
            var i;
            for (i = 0; i < activePowerups.length; i += 1) {
                if (activePowerups[i].type === type) {
                    return true;
                }
            }
            return false;
        },

        // The following difficulty curve functions are based on "time points",
        // which are (game.points - game.pointsFromCoins), i.e. the number
        // of points earned from just time spent in the game. Doing it based
        // on this and not straight points prevents clear jumps in difficulty
        // after getting a bunch of coins at once, and not based on straight
        // seconds playing so that people struggling at the top of the screen
        // don't get overwhelmed too quickly.
        difficultyCurveFromTimePoints = function (x) {
            x = Math.max(x, 0); // Just in case (i.e. strongly avoiding NaN)
            return x < 20 ? 0.8 :
                   x < 100 ? 0.8 + (x - 20) * 0.001 : // (increase linearly)
                   x < 300 ? 0.83 + (x - 100) * 0.0005 : // (increase linearly)
                   x < 600 ? 0.98 : // (level off)
                   0.98 + (x - 600) * 0.0001; // (slowly, increase linearly)
        },

        unitsOfPlayerGrav = function (x) {
            return x * playerGrav * 88;
        },

        maxVyFromTimePoints = function (x) {
            x = Math.max(x, 0);
            var mvy =
                x < 20 ? 6 :
                x < 50 ? 6 :
                x < 100 ? 7 :
                x < 300 ? 7 + (x - 100) * 0.01 : // (increase linearly)
                x < 500 ? 9 : // (level off)
                x < 700 ? 9 + (x - 500) * 0.01 : // (increase linearly)
                11; // (level off)
            return unitsOfPlayerGrav(mvy);
        },

        handleActivesPoints = function (activePowerups, pointsReceived) {
            // Handle the effect that active powerups have on the amount of
            // points recieved.
            if (powerupObtained(activePowerups, "X2")) {
                return pointsReceived * 2;
            }
            return pointsReceived;
        },

        timeBasedPointsVanilla = function (playerY, realDt) {
            // Find the points earned, not including coins or powerups,
            // during this frame. 'Vanilla' because powerup effects are
            // not considered.
            var depth = playerY / gameHeight;
            var cappedDepth = Math.max(-0.5, Math.min(0.85, depth));
            return 7 * (realDt / 1000) * (1 - Math.pow((cappedDepth + 0.1) * 1.1 - 1, 2));
            // To see shape of curve, use WolframAlpha query:
            //  plot y = 1 - ((min(x, .85) + .1) * 1.1 - 1) ^ 2
        };

    // Functions operating on the game object:
    var
        gUpdaters = (function () {
            // Some util first:
            var
                addToActivePowerups = function (game, type, x, y) {
                    var newActive = createActivePowerup(type, x, y);
                    var i;
                    for (i = 0; i < game.activePowerups.length; i += 1) {
                        if (game.activePowerups[i].type === type) {
                            game.activePowerups.splice(i, 1);
                            break;
                        }
                    }
                    game.activePowerups.push(newActive);
                },
                makePowerupRandom = function (type, start, range) {
                    return createPowerup(Math.random() * range + start, type);
                },

                // Constants for handling the grid of coins:
                coinColumnsStd = 8,
                coinColWidthStd = gameWidth / coinColumnsStd,
                // When making "blocks" of coins, denser column mode is used:
                coinColumnsDense = 10,
                coinColWidthDense = gameWidth / coinColumnsDense,
                // So that random-released coins don't overlap with early pattern-released ones:
                patternCoinStartingY = coinStartingY + coinColWidthStd,
                scaleDistanceToObject = function (objToMove, target, scale) {
                    // Change the position of `objToMove' to make its distance
                    // to `target' be scaled by `scale'.
                    // Used for effect of magnet powerup on coins.
                    var relativeX = objToMove.x - target.x;
                    var relativeY = objToMove.y - target.y;
                    objToMove.x = target.x + relativeX * scale;
                    objToMove.y = target.y + relativeY * scale;
                },

                addDiagCoinPattern = function (game, do_rtl, eachCoinValue) {
                    // If do_rtl is truthy, the diag pattern
                    // will go down-and-left from the right.
                    var column, xPos, newcoin;
                    var groupId = game.nextCoinGroupId;
                    var coinsCreated = 0;
                    game.nextCoinGroupId += 1;

                    for (column = 0; column < coinColumnsStd; column += 1) {
                        xPos = (column + 0.5) * coinColWidthStd;
                        if (do_rtl) {
                            xPos = gameWidth - xPos;
                        }

                        newcoin = createCoin(xPos, patternCoinStartingY + column * coinColWidthStd, groupId);
                        game.coins.push(newcoin);
                        coinsCreated += 1;
                    }

                    game.coinReleaseMode = do_rtl ? "diagRTL" : "diagLTR";
                    game.coinReleaseModeTimeLeft = (coinColumnsStd + 1) * coinColWidthStd / (coinRiseRate * 0.9); // Approximate time the coins will take to be fully visible
                    game.coinGroups[groupId] = coinsCreated;
                    game.coinGroupBonuses[groupId] = coinsCreated * eachCoinValue * 0.5;
                },

                addCoinBlock = function (game, w, h, row, col, groupId) {
                    var curRow, curCol, xPos, yPos, newCoin;
                    var coinsCreated = 0;
                    for (curRow = row; curRow < row + h; curRow += 1) {
                        for (curCol = col; curCol < col + w; curCol += 1) {
                            xPos = (curCol + 0.5) * coinColWidthDense;
                            yPos = patternCoinStartingY + (curRow + 0.5) * coinColWidthDense;
                            newCoin = createCoin(xPos, yPos, groupId);
                            game.coins.push(newCoin);
                            coinsCreated += 1;
                        }
                    }
                    return coinsCreated;
                },

                addBlocksCoinPattern = function (game, eachCoinValue) {
                    // Generate a width and height between 2*2 and 4*4,
                    // heavily weighted against w=4 or h=4.
                    var w = 2 + Math.floor(Math.random() * 2 + 0.1);
                    var h = 2 + Math.floor(Math.random() * 2 + 0.1);
                    // Generate appropriate position of block.
                    var col = Math.floor(Math.random() * (coinColumnsDense - w));
                    var groupId = game.nextCoinGroupId;
                    game.nextCoinGroupId += 1;
                    var numCoinsCreated = addCoinBlock(game, w, h, 0, col, groupId);
                    game.coinGroups[groupId] = numCoinsCreated;
                    game.coinReleaseMode = "blocks";
                    game.coinReleaseModeTimeLeft = (h + 1) * coinColWidthDense / (coinRiseRate * 0.9);
                    game.coinGroupBonuses[groupId] = numCoinsCreated * eachCoinValue * 0.5;
                },

                addCoinRandom = function (game) {
                    var column = Math.floor(Math.random() * coinColumnsStd);
                    var pos = (column + 0.5) * coinColWidthStd;
                    var newcoin = createCoin(pos, coinStartingY + coinColWidthStd - game.coinGridOffset);
                    game.coins.push(newcoin);
                },

                setBounceVelForPlatfm = function (platfm) {
                    var abs_slope = Math.min(5, Math.abs(platfm.slope));

                    // x-direction is calculated each frame of collision, often
                    // taking into account the position of the player
                    platfm.bounceSpeedX = 0.16;
                    platfm.bounceVy = Math.min(abs_slope, 5 / abs_slope) * 0.16;
                    platfm.bounceSpeed = dist(0, 0, platfm.bounceSpeedX, platfm.bounceVy);
                },

                die = function (game) {
                    if (game.dead) {
                        return;
                    }
                    game.dead = true;
                    if (game.previewPlatfmTouch) {
                        // At this point, `game.previewPlatfmTouch === Touch.curTouch',
                        // so to freeze the shape of the preview-platfm, set it to
                        // a copy of itself
                        game.previewPlatfmTouch = Touch.copy(game.previewPlatfmTouch);
                    }
                    Render.clearPauseBtn(game);
                };

            return {
                player: function (game, dt, uncurvedDt) {
                    var i, val, collided = false;

                    if (game.previewPlatfmTouch
                            && Collision.player_platfm(game.player, game.previewPlatfmTouch)) {
                        // Use game.previewPlatfmTouch rather than Touch.curTouch
                        // so that in runTutorial, the automated touch still
                        // is used here in place of a real touch.
                        maybeGetPlatfmFromTouch(game.previewPlatfmTouch, function (platfm) {
                            game.platfms.push(platfm);
                            Touch.curTouch = null;
                            // Reset Touch.curTouch so that as user slides
                            // finger before lifting it, another platfm doesn't
                            // show up unwantedly due to the fact that curTouch
                            // is still non-null.
                            game.previewPlatfmTouch = null;
                        });
                    }

                    if (game.player.y > gameHeight + playerRadius) {
                        die(game);
                        // The frame finishes, with all other components also
                        // being updated before the GameOver screen apperas, so
                        // so does the player's position. This is why there is
                        // no 'return;' here.
                    }

                    // Iterate backwards through game.platfms in the following
                    // so that recently created platfms take precedence. (Loop
                    // ends after the first detected collision.)
                    var curPlayerSpeed;
                    for (i = game.platfms.length - 1; i >= 0 && !collided; i -= 1) {
                        val = game.platfms[i];
                        if (Collision.player_platfm(game.player, val)) {
                            collided = true;
                            if (!curPlayerSpeed) {
                                curPlayerSpeed = Vector.findMagnitude(game.player);
                            }

                            if (!val.bounceSpeedX) {
                                setBounceVelForPlatfm(val);
                            }

                            game.player.vx = val.bounceSpeedX;
                            game.player.vy = val.bounceVy;

                            if (Math.abs(val.slope) < 5) {
                                // Just follow the direction of the platfm:
                                game.player.vx *= Math.sign(val.slope);
                            } else {
                                // Bounce leftward if the player is to the left
                                // of the platfm, right if he is to the right:
                                game.player.vx *= Math.sign(game.player.x - ((val.y1 - game.player.y) / val.slope + val.x1));
                            }

                            game.player.vy -= platfmRiseRate;
                        }
                    }

                    if (!collided) {
                        if (powerupObtained(game.activePowerups, "weight")) {
                            game.player.vy += playerGrav * 5 / 2 * uncurvedDt;
                        } else {
                            game.player.vy += playerGrav * uncurvedDt;
                        }
                        // In each of the above, the velocity addition must
                        // be scaled by `uncurvedDt` because it represents the
                        // accumulation of gravity over `uncurvedDt` milliseconds.
                    }

                    game.player.vy = Math.min(game.player.vy, maxVyFromTimePoints(game.points - game.pointsFromCoins));
                    game.player.ducking = false;

                    for (i = 0; i < game.fbs.length; i += 1) {
                        if (!game.player.ducking && Collision.playerHeadNearFb(game.player, game.fbs[i])) {
                            game.player.ducking = true;
                        }
                        if (Collision.player_fb(game.player, game.fbs[i])) {
                            die(game);
                        }
                    }

                    var diffCurve = difficultyCurveFromTimePoints(game.points - game.pointsFromCoins);
                    var curCoinValue = handleActivesPoints(game.activePowerups, coinValue * diffCurve);

                    for (i = 0; i < game.coins.length; i += 1) {
                        val = game.coins[i];
                        if (Collision.player_coin(game.player, val)) {
                            if (Number.isFinite(val.groupId) && game.coinGroups.hasOwnProperty(val.groupId)) {
                                game.coinGroups[val.groupId] -= 1;
                                if (game.coinGroups[val.groupId] <= 0) {
                                    delete game.coinGroups[val.groupId];
                                    game.points += game.coinGroupBonuses[val.groupId];
                                    delete game.coinGroupBonuses[val.groupId];
                                    game.coinGroupGottenNotifs.push({
                                        x: game.player.x,
                                        y: game.player.y,
                                        x0: game.player.x,
                                        y0: game.player.y,
                                        t0: Date.now()
                                    });
                                }
                            }
                            game.coins.splice(i, 1);
                            game.points += curCoinValue;
                            game.pointsFromCoins += curCoinValue;
                        }
                    }

                    var dx = 0.02 * dt;
                    var dy = -(coinRiseRate + 0.03) * dt;
                    for (i = 0; i < game.coinGroupGottenNotifs.length; i += 1) {
                        val = game.coinGroupGottenNotifs[i];
                        if (Date.now() - val.t0 > 1000) {
                            return game.coinGroupGottenNotifs.splice(i, 1);
                        }
                        if (val.x0 > gameWidth * 0.5) {
                            dx *= -1;
                        }
                        val.x += dx;
                        val.y += dy;
                    }

                    forEachInObject(game.powerups, function (pname, powerup) {
                        if (Collision.player_powerup(game.player, powerup)) {
                            delete game.powerups[pname];
                            addToActivePowerups(
                                game,
                                powerup.type,
                                calcPowerupXPos(powerup),
                                calcPowerupXPos(powerup)
                            );
                        }
                    });

                    game.player.x = modulo(game.player.x + game.player.vx * uncurvedDt, gameWidth);
                    game.player.y += game.player.vy * uncurvedDt;
                    game.player.wheelAngle += Math.sign(game.player.vx) * 0.22 * uncurvedDt;
                },

                fbs: updateFbsGeneric,

                coins: function (game, dt) {
                    var magnetOn = powerupObtained(game.activePowerups, "magnet");
                    var dy = coinRiseRate * dt;

                    // The coins are all rendered in a vertically
                    // sliding grid, and coinGridOffset keeps track of
                    // the distance to the lowest on-screen invisible
                    // horizontal line of that grid from the base of
                    // the screen.
                    game.coinGridOffset += dy;
                    game.coinGridOffset = game.coinGridOffset % coinColWidthStd;

                    var i, coin, distSqd, distScaleFactor;
                    for (i = 0; i < game.coins.length; i += 1) {
                        coin = game.coins[i];
                        coin.y -= dy;
                        if (magnetOn) {
                            // Slide coin closer to player
                            distSqd = distanceSquared(coin.x, coin.y, game.player.x, game.player.y);
                            if (distSqd < 10000) {
                                distScaleFactor = 1 - 100 / distSqd;
                                scaleDistanceToObject(coin, game.player, distScaleFactor);
                                // Logic behind definition of distScaleFactor:
                                // We want to set distance to `player' to
                                //    (curDistance - (100 / curDistance)),
                                // so we equivalently want to scale the distance by
                                //   (curDistance - (100 / curDistance)) / curDistance
                                //   = 1 - 100 / curDistance^2
                                // The prior math breaks down when curDistance < 10,
                                // (which would make the scale factor negative), but
                                // by then the coin will have collided with the player
                                // and thus been removed from `game.coins'
                            }
                        }

                        if (coin.y < -2 * coinRadius) {
                            if (typeof coin.groupId === "number" && game.coinGroups[coin.groupId]) {
                                delete game.coinGroups[coin.groupId];
                                delete game.coinGroupBonuses[coin.groupId];
                                // Since a coin has escaped, the group data
                                // can be discarded entirely.
                            }
                            game.coins.splice(i, 1);
                        }
                    }

                    // Release modes are: "random", "blocks", "diagLTR", "diagRTL"
                    var diffCurve = difficultyCurveFromTimePoints(game.points - game.pointsFromCoins);
                    var curCoinValue = handleActivesPoints(game.activePowerups, coinValue * diffCurve);
                    var random = Math.random(); // Used in all following if/else branches
                    if (game.coinReleaseMode === "random") {
                        if (Math.random() < (dt / 1000) / 6) {
                            if (random < 0.2) {
                                addDiagCoinPattern(game, Math.random() < 0.5, curCoinValue);
                            } else {
                                addBlocksCoinPattern(game, curCoinValue);
                            }
                        } else if (random < 1 / 1500 * dt) {
                            // In this case "random" mode is still going and
                            // a coin is due to be added (due to random condition)
                            addCoinRandom(game);
                        }
                    } else if (game.coinReleaseMode === "blocks") {
                        if (game.coinReleaseModeTimeLeft <= 0) {
                            if (random < 0.5) {
                                addBlocksCoinPattern(game, curCoinValue);
                            } else if (random < 0.9) {
                                game.coinReleaseMode = "random";
                            } else {
                                addDiagCoinPattern(game, Math.random() < 0.5, curCoinValue);
                            }
                        }
                    } else { // For diagLTR and diagRTL
                        if (game.coinReleaseModeTimeLeft <= 0) {
                            if (random < 0.25) {
                                addDiagCoinPattern(game, game.coinReleaseMode === "diagLTR", curCoinValue);
                            } else if (random < 0.8) {
                                game.coinReleaseMode = "random";
                            } else {
                                addBlocksCoinPattern(game, curCoinValue);
                            }
                        }
                    }

                    if (Number.isFinite(game.coinReleaseModeTimeLeft)) {
                        game.coinReleaseModeTimeLeft -= dt;
                    }
                },

                platfms: function (game, dt) {
                    var i;
                    for (i = 0; i < game.platfms.length; i += 1) {
                        game.platfms[i].y0 -= platfmRiseRate * dt;
                        game.platfms[i].y1 -= platfmRiseRate * dt;
                        game.platfms[i].time_left -= dt;
                        if (game.platfms[i].time_left <= 0) {
                            game.platfms.splice(i, 1);
                        }
                    }
                },

                powerups: function (game, dt) {
                    forEachInObject(game.powerups, function (pname, powerup) {
                        powerup.lifetime += dt;
                        if (calcPowerupXPos(powerup) >
                                gameWidth + powerupBubbleRadius + playerRadius) {
                            // The '+ playerRadius' is so that he can catch
                            // one just as it disappears.
                            delete game.powerups[pname];
                        }
                    });

                    var possib = powerupCreationChanceFactor * dt;

                    if (!game.powerups.X2 && Math.random() < possib) {
                        game.powerups.X2 = makePowerupRandom("X2", 25, 145);
                    } else if (!game.powerups.slow && Math.random() < possib) {
                        game.powerups.slow = makePowerupRandom("slow", 25, 145);
                    } else if (!game.powerups.weight && game.points > 50 && Math.random() < possib) {
                        game.powerups.weight = makePowerupRandom("weight", 25, 145);
                    } else if (!game.powerups.magnet && Math.random() < possib) {
                        game.powerups.magnet = makePowerupRandom("magnet", 25, 145);
                    }
                },

                activePowerups: function (game, dt) {
                    var i, active;
                    for (i = 0; i < game.activePowerups.length; i += 1) {
                        active = game.activePowerups[i];
                        if (active.lifetime <= 0) {
                            game.activePowerups.splice(i, 1);
                        }
                        active.lifetime -= dt;
                        if (active.timeSinceAcquired < activePowerupTravelTime) {
                            active.timeSinceAcquired += dt;
                        }
                    }
                }
            };
        }()),

        gEventHandlers = {
            handleTouchendForThemeSwitch: function (touch) {
                var touchTime = Date.now() - touch.t0;
                if (Math.abs(touch.x0 - touch.x1) >= gameWidth * 0.5 && touchTime < 400) {
                    starfieldActive = !starfieldActive;
                }
            },

            handleTouchendForPlatfmAdd: function (game, touch) {
                if (!game.paused && !game.dead) {
                    maybeGetPlatfmFromTouch(touch, function (platfm) {
                        game.platfms.push(platfm);
                        game.previewPlatfmTouch = null;
                        // If previewPlatfmTouch were not reset to null, then when
                        // the user lifts finger at same time the preview is hit by
                        // the player, two platfms would be created at that position.
                    });
                }
            },

            handleDocumentClick: function (game, touch, restart, disallowPause) {
                if (game.paused) {
                    if (touchIsInsideBtn(touch, resumeBtn)) {
                        game.paused = false;
                        Render.pauseBtn(game);
                    }
                } else if (game.dead) {
                    if (touchIsInsideBtn(touch, replayBtn)) {
                        restart();
                    }
                } else if (!disallowPause && touchIsInPauseBtn(touch)) {
                    game.paused = true;
                    Render.clearPauseBtn(game);
                }
            }
        };

    // Update/render loops of home menu and gameplay:
    var
        play = function (existingGame) {
            var
                game = existingGame || createGame(),
                restart = function () {
                    game = createGame();
                    setCurGame(game);
                    Render.pauseBtn(game);
                },
                prevFrameTime = performance.now() - 20,
                startTime = performance.now();
            setCurGame(game);
            window.deltas = window.deltas || [];

            runLoop(function (now, rafUsed) {
                window.game = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.

                // Initialize time deltas
                var realDt = now - prevFrameTime;
                if (!game.paused && !game.dead) {
                    if (startTime !== now) {
                        // To prevent the first time delta (made to
                        // always be 20) from confusing the data
                        window.deltas.push(realDt);
                    }
                }

                var uncurvedDt = realDt;
                realDt *= difficultyCurveFromTimePoints(game.points - game.pointsFromCoins);

                // Handle effects of slow powerup
                var dt = realDt;
                if (powerupObtained(game.activePowerups, "slow")) {
                    dt *= 2 / 3;
                    uncurvedDt *= 2 / 3;
                    // Any functions given 'dt' as the time delta will thus
                    // behave as if 2/3 as much time has passed.
                }
                prevFrameTime = now;

                game.prevPoints = game.points === 0 ? -1 : game.points;

                if (Touch.curTouch && !game.dead && !game.paused) {
                    // If the current rendered state of the pause btn
                    // (pressed or not pressed) is incorrect given the
                    // touch position, redraw the pause btn
                    if (game.pauseBtnDown !== touchIsInPauseBtn(Touch.curTouch)) {
                        Render.pauseBtn(game);
                    }
                }

                if (rafUsed && !game.paused && !game.dead) {
                    Render.background(true);
                }
                if (game.paused) {
                    Render.gamePaused(game);
                } else if (game.dead) {
                    Render.gameDead(game);
                } else {
                    // Update state
                    game.previewPlatfmTouch = Touch.curTouch;
                    gUpdaters.player(game, dt, Math.min(dt, uncurvedDt * 0.83));
                    gUpdaters.coins(game, dt);
                    gUpdaters.fbs(game, dt);
                    gUpdaters.platfms(game, dt);
                    gUpdaters.powerups(game, dt);
                    gUpdaters.activePowerups(game, dt);

                    game.points += handleActivesPoints(game.activePowerups, timeBasedPointsVanilla(game.player.y, realDt));
                    // timeBasedPointsVanilla is given `realDt', not dt. This
                    // means when the slow powerup is held, points still flow
                    // in at the normal speed from the user's perspective.

                    if (game.points < 0) {
                        game.points = 0;
                        // Although a user floating above the top of the screen
                        // should lose points, negative points don't make sense.
                    }

                    if (game.dead) {
                        // If, after updating the game state, the game is over,
                        // then compare it with highscores.
                        highscores.sendScore(Math.floor(game.points));
                    }

                    // Render
                    Render.game(game);
                }
            });

            Touch.onTouchend = function (touch) {
                gEventHandlers.handleTouchendForPlatfmAdd(game, touch);

                if (game.paused || game.dead) {
                    gEventHandlers.handleTouchendForThemeSwitch(touch);
                }
                if (Touch.touchIsValidAsTap(touch)) {
                    gEventHandlers.handleDocumentClick(game, touch, restart);
                }
            };

            Render.pauseBtn(game);
        },

        createAutomatedTouch = function (dir) {
            var autoTouchStartY = 230;
            var autoTouchStartXDiff = gameWidth * 0.3;
            var x = gameWidth / 2 + dir * autoTouchStartXDiff;
            return {
                x0: x,
                y0: autoTouchStartY,
                x1: x,
                y1: autoTouchStartY
            };
        },

        stepAutomatedTouch = function (autoTouch, dt) {
            if (autoTouch.x0 > gameWidth / 2) {
                autoTouch.x1 -= 0.44 * dt;
            } else {
                autoTouch.x1 += 0.44 * dt;
            }
            autoTouch.y1 += 0.31 * dt;
        },

        timeBetweenAutoTouches = 450,
        runTutorial = function () {
            var
                game = createGame(),
                prevFrameTime = performance.now() - 20,
                autoTouchDir = 1,
                curAutomatedTouch = createAutomatedTouch(autoTouchDir),
                interTouchWait = 0,
                materializeAutoTouch = function () {
                    maybeGetPlatfmFromTouch(curAutomatedTouch, function (platfm) {
                        game.platfms.push(platfm);
                    });
                    autoTouchDir *= -1;
                    curAutomatedTouch = createAutomatedTouch(autoTouchDir);
                    interTouchWait = timeBetweenAutoTouches;
                },
                realGameReady = false,
                restartTut = function () {
                    game = createGame();
                    curAutomatedTouch = createAutomatedTouch(autoTouchDir);
                };

            var prevX, prevY, midwayX, midwayY;

            runLoop(function (now, rafUsed) {
                if (realGameReady) {
                    play(game);
                    return true;
                }

                window.tutorial = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.

                // Initialize time delta
                var dt = now - prevFrameTime;

                var uncurvedDt = dt;
                dt *= difficultyCurveFromTimePoints(0);

                prevFrameTime = now;

                if (rafUsed && !game.paused && !game.dead) {
                    Render.background(true);
                }
                if (game.paused) {
                    Render.gamePaused(game);
                } else if (game.dead) {
                    Render.gameDead(game);
                } else {
                    // Update state
                    gUpdaters.player(game, dt, uncurvedDt * 0.83);
                    gUpdaters.platfms(game, dt);

                    if (Touch.curTouch) {
                        materializeAutoTouch();
                        realGameReady = true;
                    }

                    if (curAutomatedTouch.y1 > 290) {
                        materializeAutoTouch();
                    } else if (interTouchWait <= 0) {
                        stepAutomatedTouch(curAutomatedTouch, dt);
                    } else {
                        interTouchWait -= dt;
                    }

                    // Placement of hand
                    if (interTouchWait <= 0) {
                        // Put it at the end of the automated touch
                        prevX = midwayX = curAutomatedTouch.x1;
                        prevY = midwayY = curAutomatedTouch.y1;
                    } else {
                        // Slide it towards the start of the next touch
                        midwayX -= (prevX - curAutomatedTouch.x0) * dt / timeBetweenAutoTouches;
                        midwayY -= (prevY - curAutomatedTouch.y0) * dt / timeBetweenAutoTouches;
                    }

                    // Render
                    if (!game.dead && !game.paused) {
                        game.previewPlatfmTouch = Touch.curTouch || curAutomatedTouch;
                    }
                    Render.tutorial(game, midwayX, midwayY);
                }
            });

            Touch.onTouchend = function (touch) {
                gEventHandlers.handleTouchendForPlatfmAdd(game, touch);
                if (game.paused || game.dead) {
                    gEventHandlers.handleTouchendForThemeSwitch(touch);
                }
                if (Touch.touchIsValidAsTap(touch)) {
                    gEventHandlers.handleDocumentClick(game, touch, restartTut, true);
                }
            };
        },
        createMenu = function () {
            return {
                fbs: []
            };
        },
        runMenu = function () {
            var
                menu = createMenu(),
                prevFrameTime = performance.now() - 20,
                startGame = function () {
                    Touch.onTouchend = null;
                    runTutorial();
                },
                playPressed = false;

            window.menu = menu;
            window.menuDeltas = [];

            requestAnimationFrame(function runFrame(now) {
                if (playPressed) {
                    return startGame();
                }
                requestAnimationFrame(runFrame);
                var dt = now - prevFrameTime;
                window.menuDeltas.push(dt);
                prevFrameTime = now;
                updateFbsGeneric(menu, dt * 0.83);
                Render.background(true);
                Render.menu(menu);
            });

            Touch.onTouchend = function (touch) {
                gEventHandlers.handleTouchendForThemeSwitch(touch);
                if (Touch.touchIsValidAsTap(touch)) {
                    if (touchIsInsideBtn(touch, menuPlayBtn)) {
                        playPressed = true;
                    }
                }
            };
        };
    runMenu();
}());
