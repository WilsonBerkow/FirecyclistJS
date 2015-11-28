// (c) Wilson Berkow
// Firecyclist.js

if (typeof Math.log2 !== "function") {
    Math.log2 = function (e) {
        "use strict";
        return Math.log(e) / Math.LN2;
    };
}

(function () {
    "use strict";
    var bgCanvas = document.getElementById("bgCanvas"),
        mainCanvas = document.getElementById("canvas"),
        btnCanvas = document.getElementById("btnCanvas"),
        overlayCanvas = document.getElementById("overlayCanvas"),
        gameWidth = 576 / 2,
        gameHeight = 1024 / 2;

    // Resize and center game canvases:
    var pageScaleFactor = 1,
        calcTouchPos;
    (function () {
        var htmlModule = document.getElementById("Main"),
            windowDims = {
                width: window.innerWidth || document.documentElement.clientWidth, // The defaulting expression (.documentElement....) is for IE
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
            // the canvas handles all color in the 288x576 so for the sake of
            // those playing in the browser, set body background back to black:
            document.body.setAttribute("style", "background-color: black;");
        }
        calcTouchPos = function (event) {
            return {
                x: ((typeof event.clientX === "number" ? event.clientX : event.changedTouches[0].clientX) - moduleOffsetX) / pageScaleFactor,
                y: (typeof event.clientY === "number" ? event.clientY : event.changedTouches[0].clientY) / pageScaleFactor
                // event.changedTouches[0] still works when handling touchend,
                // while event.touches[0] will be undefined.
                // event.clientX/Y are tried to allow mouse use in testing.
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
        document.onmousemove = document.ontouchmove = function (event) {
            var xy = calcTouchPos(event);
            if (Touch.curTouch !== null) { // Condition fails when a platfm has been materialized, and thus curTouch was reset to null
                Touch.curTouch.x1 = xy.x;
                Touch.curTouch.y1 = xy.y;
            }
            event.preventDefault(); // Stops the swipe-to-move-through-browser-history feature in Chrome from interferring.
        };
        document.onmousedown = document.ontouchstart = function (event) {
            var now = Date.now(), xy = calcTouchPos(event);
            Touch.curTouch = {
                t0: now,
                id: touchesCount,
                x0: xy.x,
                y0: xy.y,
                x1: xy.x,
                y1: xy.y
            };
            touchesCount += 1;
        };
        document.onmouseup = document.ontouchend = function () {
            if (typeof Touch.onTouchend === "function" && Touch.curTouch) {
                Touch.onTouchend(Touch.curTouch);
            }
            Touch.curTouch = null;
            // Do not use preventDefault here, it prevents
            // triggering of the 'tap' event.
        };
        return {
            curTouch: null,
            onTouchend: null,
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
        };
    }());

    // Generic util:
    var makeObject = function (proto, props) {
            var o = Object.create(proto);
            Object.keys(props).forEach(function (key) {
                o[key] = props[key];
            });
            return o;
        },
        iterableObjectFactory = function (propsToIter) {
            var proto = {
                forEach: function (f) {
                    var obj = this;
                    propsToIter.forEach(function (prop) {
                        var val = obj[prop];
                        if (val !== undefined && val !== null) {
                            f(val, prop);
                        }
                    });
                }
            };
            return function (props) {
                return makeObject(proto, props);
            };
        },
        modulo = function (num, modBy) {
            if (num < 0) {
                return modulo(modBy + num, modBy);
            }
            return num % modBy;
        },
        pythag = function (a, b) {
            return Math.sqrt(a * a + b * b);
        },
        distanceSquared = function (x0, y0, x1, y1) {
            var dx = x1 - x0;
            var dy = y1 - y0;
            return dx * dx + dy * dy;
        },
        dist = function (x0, y0, x1, y1) {
            return quickSqrt(distanceSquared(x0, y0, x1, y1));
        },
        distLT = function (x0, y0, x1, y1, compareWith) {
            var distSquared = distanceSquared(x0, y0, x1, y1);
            return distSquared < compareWith * compareWith;
        },
        sqrt3 = Math.sqrt(3),
        oneDegree = Math.PI / 180,
        trig = (function () {
            var sines = [],   // Sine and cosine tables are used so that the approximation work doesn't
                cosines = [], // have to be done more than once for any given angle. The angles of the
                              // spokes are rounded down to the nearest degree.
                sin = function (radians) {
                    return sines[modulo(Math.floor(radians / oneDegree), 360)];
                },
                cos = function (radians) {
                    return cosines[modulo(Math.floor(radians / oneDegree), 360)];
                },
                i;
            for (i = 0; i < 360; i += 1) {
                sines[i] = Math.sin(i * oneDegree);
                cosines[i] = Math.cos(i * oneDegree);
            }
            return {sin: sin, cos: cos};
        }()),
        quickSqrt = (function () {
            var sqrts = {}; // square root of x is at sqrts[x * 2]
            var i;
            for (i = 0; i < 500; i += 1) {
                sqrts[i] = Math.sqrt(i / 2);
            }
            return function (x) {
                var i = Math.round(x * 2);
                if (sqrts[i] === undefined) {
                    sqrts[i] = Math.sqrt(i / 2);
                }
                return sqrts[i];
            };
        }()),
        // For dealing with periods (sets of 3 digits, read RTL) in a natural number:
        getPeriodsReverse = function (num) {
            // Returns an array of the periods in num, from least
            // to greatest significance.
            var pds = [];
            var pdNum = 0;
            do {
                pds.push(num % 1000); // push the first period in `num`
                pdNum += 1;
                num = Math.floor(num / 1000); // discard first period in `num` and slide rest over
            } while (num > 0);
            return pds;
        },
        padNumericPeriod = function (num) {
            // E.g., if given 34, returns "034"
            return num < 10 ? "00" + num :
                   num < 100 ? "0" + num :
                   "" + num;
        };

    // Config:
    var starfieldActive = false,
        approxFrameLen = 1000 / 60, // With requestAnimationFrame, this is approximate
        playerGrav = 0.3 / 28,
        fbRiseRate = 0.1,
        fbRadius = 10,
        fbNumRecordedFrames = 300,
        coinRiseRate = 0.1,
        coinRadius = 10,
        coinSquareLen = 8.5,
        coinValue = 11,
        coinStartingY = gameHeight + coinRadius,
        platfmRiseRate = 0.15,
        totalFbHeight = 10,
        platfmBounciness = 0.07,
        platfmThickness = 6,
        playerTorsoLen = 15 * 5/8,
        playerRadius = 10 * 6/8,
        playerHeadRadius = 9 * 5/8,
        playerElbowXDiff = 8 * 5/8,
        playerElbowYDiff = 2 * 5/8,
        playerWheelToHeadDist = playerTorsoLen + playerRadius + playerHeadRadius,
        playerDuckingXDiff = -3,
        playerDuckingYDiff = -10,
        powerupTotalLifespan = 5500, // in milliseconds
        inGamePointsPxSize = 30,
        inGamePointsYPos = 9,
        activePowerupsStartingXPos = gameWidth - 78,
        activePowerupTravelTime = 250,
        activePowerupBubbleRadius = 18,
        mkBtn = (function () {
            var proto = {
                edgeX: function () {
                    return this.x - this.w / 2;
                },
                touchIsInside: function (xy) {
                    var withinHeight = xy.y1 >= this.y && xy.y1 <= this.y + this.h;
                    var withinWidth = xy.x1 >= this.edgeX() && xy.x1 <= this.edgeX() + this.w;
                    return withinHeight && withinWidth;
                }
            };
            return function (o) {
                o.redTint = !!o.redTint;
                o.textWDiff = o.textWDiff || 0;
                o.textHDiff = o.textHDiff || 0;
                o.textXOffset = o.textXOffset || 0;
                return makeObject(proto, o);
            };
        }()),
        menuPlayBtn = mkBtn({
            text: "Play",
            font: "italic bold 53px i0",
            x: gameWidth / 2,
            y: 280,
            w: 121,
            h: 57,
            textHDiff: -13
        }),
        replayBtn = mkBtn({
            text: "Replay",
            font: "bold 33px b0",
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
            font: "bold 30px b0",
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
        btnShadowOffset = 2,
        powerupX2Width = 36,
        powerupX2Height = 23,
        powerupSlowRadius = 12,
        powerupMagnetRadius = 9,
        powerupMagnetThickness = 8,
        powerupWeightScaleUnit = 0.8,
        powerupWeightHandleHeight = 4,
        powerupWeightBlockUpperXMargin = 3,
        powerupWeightBlockLowerWidth = 30,
        powerupWeightBlockHeight = 20,
        powerupWeightHeight = powerupWeightBlockHeight + powerupWeightHandleHeight,
        activePowerupLifespan = 10000;

    // Highscore update and storage:
    var mkHighscores = function (identifier) {
            var scores = [null, null, null], // Highest scores are at the beginning, null represents an empty slot.
                fromLocal = localStorage.getItem(identifier);
            if (fromLocal !== null) {
                fromLocal = JSON.parse(fromLocal);
                if (fromLocal) {
                    scores = fromLocal;
                }
            }
            return {
                highest: function (n) { // Note that the nulls of empty slots are included
                    var arr = [], i;
                    n = n || scores.length;
                    for (i = 0; i < Math.min(n, scores.length); i += 1) {
                        arr.push(scores[i]);
                    }
                    return arr;
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
            };
        },
        highscores = mkHighscores("highscores");

    // Vector and line util:
    var relativeVector = function (f) {
            var proto = Object.freeze({
                angle: function () {
                    return Math.atan2(this.vy, this.vx);
                },
                magnitudeSquared: function () {
                    return this.vx * this.vx + this.vy * this.vy;
                },
                setMagnitude: function (mag) {
                    var angle = this.angle();
                    this.vx = trig.cos(angle) * mag;
                    this.vy = trig.sin(angle) * mag;
                }
            });
            return function () {
                return makeObject(proto, f.apply(this, [].slice.apply(arguments)));
            };
        },
        createVel = relativeVector(function (vx, vy) {
            return {vx: vx, vy: vy};
        }),
        withAngularCtrls = (function () {
            var proto = {
                angleTo: function (xy) { // Currently unused, but as definition adds only constant time and may be useful in future, I'll leave it.
                    return Math.atan2(xy.y - this.y, xy.x - this.x);
                },
                distanceSqdTo: function (xy) {
                    return distanceSquared(this.x, this.y, xy.x, xy.y);
                },
                setDistanceTo: function (obj, newDist) {
                    var posRelToPlayer = createVel(this.x - obj.x, this.y - obj.y);
                    posRelToPlayer.setMagnitude(newDist);
                    this.x = obj.x + posRelToPlayer.vx;
                    this.y = obj.y + posRelToPlayer.vy;
                    // .vx and .vy are just position deltas, not velocities
                }
            };
            return function (f) {
                return function () {
                    return makeObject(proto, f.apply(this, [].slice.apply(arguments)));
                };
            };
        }());

    // Constructors for in-game objects:
    var createPlayer = relativeVector(function (x, y, vx, vy) {
            return {x: x, y: y, vx: vx, vy: vy, wheelAngle: 0, ducking: false};
        }),
        createPlatfm = function (x0, y0, x1, y1) {
            return {
                x0: x0,
                y0: y0,
                x1: x1,
                y1: y1,
                time_left: 800,
                lengthSquared: distanceSquared(x0, y0, x1, y1),
                bounceVx: undefined,
                bounceVy: undefined,
                bounceSpeed: undefined
                // bounceSpeed is a cache of the magnitude of
                // the vector (bounceVx, bounceVy)
            };
        },
        createCoin = withAngularCtrls(function (x, y, groupId) {
            return {x: x, y: y, groupId: groupId};
        }),
        createFb = function (x, y) {
            return {x: x, y: y, frame: Math.floor(Math.random() * fbNumRecordedFrames)};
        },
        createPowerup = (function () {
            var proto = {
                xDistanceTravelled: function () {
                    return this.lifetime / powerupTotalLifespan * gameWidth;
                },
                xPos: function () {
                    return this.xDistanceTravelled();
                },
                yPos: function () {
                    return this.offsetY + trig.sin(this.xDistanceTravelled() / 20) * 40;
                }
            };
            return function (y, powerupType) {
                return makeObject(proto, {offsetY: y, lifetime: 0, type: powerupType});
            };
        }()),
        createActivePowerup = function (type, srcX, srcY) {
            var lifetime = type === "slow" ? activePowerupLifespan / 2 : activePowerupLifespan;
            return {
                type: type,
                width: type === "X2" ? powerupX2Width :
                       type === "slow" ? powerupSlowRadius * 2 :
                       type === "weight" ? 40 :
                       type === "magnet" ? powerupSlowRadius * 2 + 15 :
                       40,
                totalLifetime: lifetime,
                lifetime: lifetime,
                srcX: srcX,
                srcY: srcY,
                timeSinceAcquired: 0
            };
        },
        createGame = (function () {
            var mkPowerupsObj = iterableObjectFactory(["X2", "slow", "weight", "magnet"]);
            return function () {
                return {
                    player: createPlayer(gameWidth / 2, 50, 0, 0),
                    platfms: [],
                    previewPlatfmTouch: null,
                    fbs: [],
                    firebitsRed: [],
                    firebitsOrg: [],
                    coins: [],
                    coinGroups: {},
                    // `game.coinGroups[i]` holds the number of still-living coins in the coinGroup with ID `i`
                    coinGroupBonuses: {},
                    // `game.coinGroupBonuses[i]` holds the points gained from getting all coins in group `i`
                    coinGroupGottenNotifs: [],
                    nextCoinGroupId: 0,
                    coinReleaseMode: "random",
                    coinReleaseModeTimeLeft: null, // In "random" mode, mode switch is random, not timed
                    coinGridOffset: 0,
                    powerups: mkPowerupsObj({}),
                    activePowerups: [],
                    points: 0,
                    pointsFromCoins: 0,
                    paused: false,
                    dead: false,
                    statsPrev: {},
                    stats: {} // For debugging aid
                };
            };
        }());

    // Rendering:
    var Render = (function () {
        var bgCtx = bgCanvas.getContext("2d"),
            mainCtx = mainCanvas.getContext("2d"),
            btnCtx = btnCanvas.getContext("2d"),
            overlayCtx = overlayCanvas.getContext("2d");
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
        var fillShadowyText = function (ctx, text, x, y, reverse, offsetAmt, w, h) {
                // Doesn't set things like ctx.font and ctx.textAlign so that they
                // can be set on ctx by the caller, before invoking.
                var neutralClr = starfieldActive ? "white" : "black";
                var brightClr = starfieldActive ? "royalblue" : "darkOrange";
                var clr0 = reverse ? neutralClr : brightClr,
                    clr1 = reverse ? brightClr : neutralClr,
                    offset = offsetAmt || 1,
                    setW = w !== undefined;
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
            circle = function (ctx, x, y, radius, color, fillOrStroke) {
                ctx.beginPath();
                ctx[fillOrStroke + "Style"] = color;
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                ctx[fillOrStroke]();
            },
            circleAt = function (ctx, x, y, radius) {
                ctx.moveTo(x + radius, y); // A line is always drawn from the current position to the start of the drawing of the circle, so the '+ radius' puts the brush at that point on the circle, (x+radius, y), to prevent extraneous lines from being painted.
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
            },
            lineFromTo = function (ctx, x0, y0, x1, y1) {
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
            },
            oneArm = function (ctx, reverse) {
                if (reverse) {
                    ctx.scale(-1, -1);
                }
                ctx.moveTo(0, 0);
                ctx.lineTo(-playerElbowXDiff, -playerElbowYDiff);
                ctx.lineTo(-2 * playerElbowXDiff, playerElbowYDiff);
            },
            wheelSpokesAt = function (ctx, x, y, angle) {
                var spokeAngle = 0, spinOffset = angle * oneDegree, relX, relY, i;
                for (i = 0; i < 6; i += 1) {
                    relX = trig.cos(spinOffset + spokeAngle) * playerRadius;
                    relY = trig.sin(spinOffset + spokeAngle) * playerRadius;
                    ctx.moveTo(x + relX, y + relY);
                    ctx.lineTo(x - relX, y - relY);
                    if (i !== 5) {
                        spokeAngle += 1/3 * Math.PI;
                    }
                }
            },
            wheelOutlineAt = function (ctx, x, y, useStarsStyle) {
                // Wheel outline is drawn in two solid parts to get around
                // Chrome-for-Android rendering bug for outlined arcs of
                // a certian size.
                ctx.save();

                ctx.beginPath();
                circleAt(ctx, x, y, playerRadius);
                ctx.fillStyle = useStarsStyle ? "white" : "black";
                ctx.fill();

                ctx.beginPath();
                circleAt(ctx, x, y, playerRadius - 1);
                ctx.clip();
                ctx.clearRect(x - playerRadius, y - playerRadius, playerRadius * 2, playerRadius * 2);

                ctx.restore();
            },
            drawPlayerDuckingAt = (function () {
                var w = playerRadius * 3;
                var h = playerRadius * 3 + 6;
                var hToWheelCenter = h - 3 - playerRadius;
                var drawStaticParts = function (useStarsStyle, ctx) {
                    var cx = w / 2, cy = hToWheelCenter;
                    ctx.strokeStyle = useStarsStyle ? "white" : "black";

                    wheelOutlineAt(ctx, cx, cy, useStarsStyle);

                    ctx.beginPath();

                    var playerHeadX = cx + playerDuckingXDiff;
                    var playerHeadY = cy + playerDuckingYDiff;

                    // Torso:
                    var torsoStartX = playerHeadX + sqrt3 / 2 * playerHeadRadius;
                    var torsoStartY = playerHeadY + 0.5 * playerHeadRadius;
                    var torsoMidX = torsoStartX + 5;
                    var torsoMidY = torsoStartY + 2;
                    ctx.moveTo(torsoStartX, torsoStartY);
                    ctx.lineTo(torsoMidX, torsoMidY);
                    ctx.lineTo(cx, cy);

                    // One arm (shadowed by head):
                    ctx.moveTo(torsoMidX, torsoMidY);
                    ctx.lineTo(torsoMidX - 1, playerHeadY - playerHeadRadius * 0.65);
                    ctx.lineTo(playerHeadX - playerHeadRadius * 1.4, playerHeadY - playerHeadRadius + 4);

                    ctx.stroke();

                    // Solid, transparent body of head, with slight extra radius for transparent border:
                    ctx.save();
                    ctx.beginPath();
                    circleAt(ctx, playerHeadX, playerHeadY, playerHeadRadius + 1);
                    ctx.clip();
                    ctx.clearRect(playerHeadX - playerHeadRadius - 1,
                                  playerHeadY - playerHeadRadius - 1,
                                  playerHeadRadius * 2,
                                  playerHeadRadius * 2);
                    ctx.restore();

                    // Now for the lines to appear in front of head:

                    ctx.beginPath();

                    // Outline of head:
                    circleAt(ctx, playerHeadX, playerHeadY, playerHeadRadius);

                    // Final arm (not shadowed by head):
                    ctx.moveTo(torsoMidX, torsoMidY);
                    ctx.lineTo(cx, playerHeadY);
                    ctx.lineTo(cx - playerHeadRadius - 3, playerHeadY + 3);

                    ctx.stroke();
                };
                var staticPartsClouds = offScreenRender(w, h, drawStaticParts.bind(null, false));
                var staticPartsStars = offScreenRender(w, h, drawStaticParts.bind(null, true));
                return function (ctx, x, y, wheelAngle) {
                    var staticParts = starfieldActive ? staticPartsStars : staticPartsClouds;
                    ctx.drawImage(staticParts, x - w / 2 - 0.5, y - hToWheelCenter - 0.5);
                    ctx.beginPath();
                    wheelSpokesAt(ctx, x, y, wheelAngle);
                    ctx.strokeStyle = starfieldActive ? "white" : "black";
                    ctx.stroke();
                };
            }()),
            drawPlayerAt = (function () {
                var w = 4 * playerElbowXDiff;
                var h = playerHeadRadius * 2 + playerTorsoLen + playerRadius * 2 + 6;
                var hToWheelCenter = playerHeadRadius * 2 + playerTorsoLen + playerRadius + 3;
                var drawStaticParts = function (useStarsStyle, ctx) {
                    var cx = w / 2, cy = hToWheelCenter; // (cx, cy) is the center of the wheel
                    ctx.strokeStyle = useStarsStyle ? "white" : "black";

                    // Circle of wheel:
                    wheelOutlineAt(ctx, cx, cy, useStarsStyle);

                    ctx.beginPath();

                    // Head and torso:
                    circleAt(ctx, cx, cy - playerWheelToHeadDist, playerHeadRadius);
                    ctx.moveTo(cx, cy - playerTorsoLen - playerRadius);
                    ctx.lineTo(cx, cy);

                    // Arms:
                    ctx.save();
                    ctx.translate(cx, cy - playerRadius - playerTorsoLen / 2);
                    oneArm(ctx);
                    oneArm(ctx, true);
                    ctx.restore();

                    ctx.stroke();
                };
                var staticPartsClouds = offScreenRender(w, h, drawStaticParts.bind(null, false));
                var staticPartsStars = offScreenRender(w, h, drawStaticParts.bind(null, true));
                return function (ctx, x, y, wheelAngle) {
                    var staticParts = starfieldActive ? staticPartsStars : staticPartsClouds;
                    ctx.drawImage(staticParts, x - w / 2 - 0.5, y - hToWheelCenter - 0.5);
                    ctx.beginPath();
                    wheelSpokesAt(ctx, x, y, wheelAngle);
                    ctx.strokeStyle = starfieldActive ? "white" : "black";
                    ctx.stroke();
                };
            }()),
            drawFbCircles = function (ctx, fbWidth) {
                ctx.beginPath();
                var i;
                for (i = 0; i < fbNumRecordedFrames; i += 1) {
                    circleAt(ctx, i * fbWidth + fbWidth / 2, fbWidth / 2, fbRadius);
                }
                ctx.fillStyle = starfieldActive ? "blue" : "orange";
                ctx.fill();
            },
            drawFirebits = function (ctx, xs, ys, color) {
                var i;
                var s = 2.5;
                ctx.beginPath();
                for (i = 0; i < xs.length; i += 1) {
                    ctx.rect(xs[i], ys[i], s, s);
                }
                ctx.fillStyle = color;
                ctx.fill();
            },
            drawFb = (function () {
                var w = 30; // Width occupied by each frame in spritesCtx
                var h = 70; // Height of each frame in spritesCtx
                var offsetRadius = w / 2;
                // window.frames from frames.js is used
                var sprites = document.createElement("canvas");
                sprites.width = fbNumRecordedFrames * w;
                sprites.height = h;
                var spritesCtx = sprites.getContext('2d');
                drawFbCircles(spritesCtx, w, fbNumRecordedFrames);
                drawFirebits(spritesCtx, frames.rx, frames.ry, "red");
                drawFirebits(spritesCtx, frames.ox, frames.oy, "darkOrange");
                return function (ctx, fb) {
                    var i = fb.frame % fbNumRecordedFrames; // In case of e.g. off by one error
                    ctx.drawImage(sprites, i * w, 0, w, h, fb.x - offsetRadius, fb.y - offsetRadius, w, h);
                };
            }()),
            drawCoin = (function () {
                var s = coinRadius * 2.5;
                var doRender = function (useStarsStyle, ctx) {
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    circleAt(ctx, s / 2, s / 2, coinRadius);
                    ctx.strokeStyle = useStarsStyle ? "darkgreen" : "orange";
                    ctx.stroke();
                    ctx.fillStyle = useStarsStyle ? "palegreen" : "yellow";
                    ctx.fill();

                    ctx.fillStyle = useStarsStyle ? "palegreen" : "darkOrange";
                    ctx.fillRect(s / 2 - coinSquareLen / 2, s / 2 - coinSquareLen / 2, coinSquareLen, coinSquareLen);
                    if (useStarsStyle) {
                        ctx.lineWidth = 1;
                    }
                    ctx.strokeRect(s / 2 - coinSquareLen / 2, s / 2 - coinSquareLen / 2, coinSquareLen, coinSquareLen);
                };
                var gold = offScreenRender(s, s, doRender.bind(null, false));
                var green = offScreenRender(s, s, doRender.bind(null, true));
                return function (ctx, coin) {
                    ctx.drawImage(starfieldActive ? green : gold, coin.x - s / 2, coin.y - s / 2);
                };
            }()),
            drawCoinGroupGottenNotif = (function () {
                var notif = document.createElement("canvas");
                var pxSize = 18;
                var txt1Offset = 12;
                notif.width = pxSize * 4;
                notif.height = pxSize * 1.5;
                var message = "100%";
                var clrOuter = "#DD0B11";
                var clrInner = "#ECB435";
                var innerX = 8;
                var innerY = 20;
                var ctx = notif.getContext("2d");

                // Set up styling of first text-draw immediately:
                ctx.lineWidth = 5;
                ctx.strokeStyle = clrOuter;

                // Wait for onload to ensure that the correct font has loaded:
                window.addEventListener("load", function () {
                    ctx.font = "bold italic " + pxSize + "px r0";

                    ctx.strokeText(message, innerX, innerY);

                    ctx.lineWidth = 3;
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
            populateSheetWithScores = function (sheet, sectW, sectH, scoreMin, scoreMax, scoreWidths, pad) {
                sheet.setAttribute("width", sectW * (scoreMax - scoreMin + 1));
                sheet.setAttribute("height", sectH);
                var sheetCtx = sheet.getContext("2d");
                sheetCtx.textAlign = "left";
                sheetCtx.font = "bold " + inGamePointsPxSize + "px r0";
                (function () {
                    // Draw numbers scoreMin to scoreMax on the sheet
                    var i, text;
                    for (i = scoreMin; i <= scoreMax; i += 1) {
                        text = pad ? padNumericPeriod(i) : i + "";
                        scoreWidths[i] = sheetCtx.measureText(text).width + 1; // `+ 1` is for shadow
                        fillShadowyText(sheetCtx,
                            text, // points
                            (i - scoreMin) * sectW, // x
                            inGamePointsPxSize); // y
                    }
                }());
            },
            drawInGamePoints = (function () {
                // Cache images of all numbers from 0 to 999
                var sheetSectionWidth = 60;
                var sheetHeight = 30;
                // Due to limits of <canvas> size, must be split into two spritesheets
                var scoreWidths = []; // Value at index `i` is width of `i` when rendered as a score
                // sheetA covers 000 to 499
                var sheetA = document.createElement("canvas");
                populateSheetWithScores(sheetA, sheetSectionWidth, sheetHeight, 0, 499, scoreWidths, true);
                // sheetB covers 500 to 999
                var sheetB = document.createElement("canvas");
                populateSheetWithScores(sheetB, sheetSectionWidth, sheetHeight, 500, 999, scoreWidths, true);
                // sheetPartial covers 0 to 99, without padding with 0s (e.g. 7 as '7', not '007')
                var nonpaddedScoreWidths = scoreWidths.slice(); // Will be the same as scoreWidths for all i > 99
                var sheetPartial = document.createElement("canvas");
                populateSheetWithScores(sheetPartial, sheetSectionWidth, sheetHeight, 0, 99, nonpaddedScoreWidths, false);

                // Use the above to draw any given period
                var drawPeriod = function (ctx, score, x, y, doPartial) { // draw three digits
                    // `score` is the value of the period (number under 1000) to be drawn
                    var sheet, position;
                    if (doPartial && score < 100) {
                        sheet = sheetPartial;
                        position = score;
                    } else if (score < 500) {
                        sheet = sheetA;
                        position = score;
                    } else {
                        sheet = sheetB;
                        position = score - 500;
                        // Subtract 500 because sheetB starts with '500' at x=0
                    }
                    ctx.drawImage(sheet,
                        position * sheetSectionWidth, 0,
                        sheetSectionWidth, sheetHeight,
                        x, y,
                        sheetSectionWidth, sheetHeight);
                };

                // Use the above to draw any number as a sequence of comma-separated periods
                var commaWidth = 7;
                var comma = offScreenRender(commaWidth, sheetHeight + 10, function (ctx) {
                    ctx.textAlign = "left";
                    ctx.font = "bold " + inGamePointsPxSize + "px r0";
                    fillShadowyText(ctx, ",", -3, inGamePointsPxSize);
                });
                var drawPeriods = function (ctx, score, x, y) {
                    var periods = getPeriodsReverse(score);
                    var i;
                    var xDisplacement = 0;
                    // For the first (most significant) period:
                    var fstPeriod = periods[periods.length - 1];
                    drawPeriod(ctx, fstPeriod, x, y, true);
                    xDisplacement += nonpaddedScoreWidths[fstPeriod];
                    // For the rest of them:
                    for (i = periods.length - 2; i >= 0; i -= 1) {
                        ctx.drawImage(comma, x + xDisplacement - 2, y);
                        xDisplacement += commaWidth;
                        drawPeriod(ctx, periods[i], x + xDisplacement, y);
                        xDisplacement += scoreWidths[periods[i]];
                    }
                };

                return function (ctx, game) {
                    drawPeriods(ctx, Math.floor(game.points), 16, inGamePointsYPos);
                };
            }()),
            drawPowerupBubble = function (ctx, x, y) {
                ctx.beginPath();
                circleAt(ctx, x, y, activePowerupBubbleRadius);
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
                        circle(ctx, cx, cy, powerupSlowRadius, "black", "stroke");
                        circle(ctx, cx, cy, powerupSlowRadius, "white", "fill");

                        // Hour hand
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        lineFromTo(ctx, cx, cy, cx + powerupSlowRadius * 0.7, cy);
                        ctx.stroke();

                        // 12 tick marks
                        var i, angle;
                        var tickOuterR = powerupSlowRadius * 0.85;
                        var tickInnerR = powerupSlowRadius * 0.8;
                        ctx.beginPath();
                        for (i = 0; i < 12; i += 1) {
                            angle = Math.PI * 2 * (i / 12);
                            lineFromTo(ctx, cx + trig.cos(angle) * tickOuterR, cy + trig.sin(angle) * tickOuterR,
                                            cx + trig.cos(angle) * tickInnerR, cy + trig.sin(angle) * tickInnerR);
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
                var fractionLifeLeft = lifeleft / totalLifetime,
                    nearDeath = fractionLifeLeft < 0.25,
                    roundAmt = nearDeath ? 120 : 60,
                    roundedFrac = Math.ceil(fractionLifeLeft * roundAmt) / roundAmt,
                    angleOfGrayArc = 2 * Math.PI * roundedFrac;
                if (angleOfGrayArc <= 0) {
                    return;
                }
                // Fill in the correct portion of the circle with gray;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, activePowerupBubbleRadius, 0, angleOfGrayArc, false);
                ctx.fillStyle = nearDeath ? "rgba(200, 0, 0, 1)" : "rgba(150, 150, 150, 0.65)";
                ctx.fill();
                if (angleOfGrayArc < 2 * Math.PI) { // To prevent the entire circle from being filled when really none should be filled. This condition can happen due to rounding in 'roundedFrac'.
                    // Fill in the rest of the circle with a ghosted gray;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.arc(x, y, activePowerupBubbleRadius, 0, angleOfGrayArc, true);
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
                        xPos -= 2.1 * activePowerupBubbleRadius;
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
                    var clrs = reddish ? tintedClrs : stdClrs;
                    clrs = starfieldActive ? starfieldClrs : clrs;
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
                var leftX = btn.edgeX() + offsetX + 9 + btn.textXOffset;
                var barsY = y + 9;
                var barW = btn.w / 4 - 2 + btn.textWDiff;
                var barH = btn.h + btn.textHDiff;
                ctx.beginPath();
                ctx.rect(leftX, barsY, barW, barH);
                ctx.rect(leftX + barW * 5 / 3, barsY, barW, barH);
                ctx.fill();
            },
            drawBtn = function (ctx, btn) {
                var pressed = Touch.curTouch && btn.touchIsInside(Touch.curTouch);
                drawButtonStructureAt(ctx, btn.edgeX(), btn.y, btn.w, btn.h, pressed, btn.tintedRed);
                var x = btn.x, y = btn.y;
                if (pressed) {
                    x -= btnShadowOffset;
                    y += btnShadowOffset;
                }
                ctx.fillStyle = starfieldActive ? "royalblue" :
                                btn.tintedRed ? "rgb(175, 145, 125)" :
                                "rgb(120, 135, 130)";
                if (btn.text === ":pause") {
                    drawPauseBars(ctx, pressed ? -btnShadowOffset : 0, y, btn);
                } else {
                    ctx.font = btn.font;
                    ctx.textAlign = "center";
                    ctx.fillText(btn.text, x + btn.textXOffset, y + btn.h + btn.textHDiff, btn.w + btn.textWDiff, btn.h + btn.textHDiff);
                }
            },
            clearBtnLayer = function () {
                btnCtx.clearRect(0, 0, gameWidth, 100);
            },
            redrawBtnLayer = function (game) {
                clearBtnLayer();
                if (!game.paused && !game.dead) {
                    drawBtn(btnCtx, pauseBtn);
                }
            },
            drawMovingBg = (function () {
                var bgsWidth = 864;
                var bgsHeight = 1024;
                var cloudsSelected; // To keep track of value of fillStyle
                var cloudImg = new Image(), cloudPattern;
                cloudImg.onload = function () {
                    cloudPattern = bgCtx.createPattern(cloudImg, "repeat");
                    bgCtx.fillStyle = cloudPattern;
                    cloudsSelected = true;
                };
                cloudImg.src = "img/bg-clouds-20-blurs.png";
                var starImg = new Image(), starPattern;
                starImg.onload = function () {
                    starPattern = bgCtx.createPattern(starImg, "repeat");
                };
                starImg.src = "img/bg-star-field.png";
                var xOffset = 0, yOffset = 0;
                return function (doMovement) {
                    xOffset = modulo(xOffset, bgsWidth);
                    yOffset = modulo(yOffset, bgsHeight);
                    if (cloudsSelected && starfieldActive) {
                        cloudsSelected = false;
                        bgCtx.fillStyle = starPattern;
                    } else if (!cloudsSelected && !starfieldActive) {
                        cloudsSelected = true;
                        bgCtx.fillStyle = cloudPattern;
                    }
                    if (cloudPattern && starPattern) {
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
                game.coins.forEach(function (coin) {
                    if (coin.y < gameHeight + coinRadius) {
                        drawCoin(mainCtx, coin);
                    }
                });
                game.coinGroupGottenNotifs.forEach(function (notif) {
                    drawCoinGroupGottenNotif(mainCtx, notif.x, notif.y);
                });
                game.fbs.forEach(function (fb) {
                    drawFb(mainCtx, fb);
                });
                game.powerups.forEach(function (powerup) {
                    var x = powerup.xPos();
                    var y = powerup.yPos();
                    drawPowerupBubble(mainCtx, x, y);
                    drawPowerup(mainCtx, powerup.type, x, y);
                });
                drawActivePowerups(mainCtx, game.activePowerups);
                if (!game.dead) {
                    drawInGamePoints(mainCtx, game);
                }
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
                var pxSize =  25;
                return function (ctx, x, y) {
                    ctx.font = "italic " + pxSize + "px i0";
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = "tan";
                    ctx.strokeText(lines[0], x, y);
                    ctx.strokeText(lines[1], x, y + pxSize);
                    ctx.fillStyle = "brown";
                    ctx.fillText(lines[0], x, y);
                    ctx.fillText(lines[1], x, y + pxSize);
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
                return function (f) {
                    return function (game) {
                        drawGame(game);
                        overlayCtx.save();
                        vagueify(overlayCtx);
                        f.apply(null, [overlayCtx].concat([].slice.apply(arguments)));
                        overlayCtx.restore();
                    };
                };
            }()),
            drawGamePaused = gameOverlayDrawer(function (ctx, game) {
                ctx.fillStyle = starfieldActive ? "royalblue" : "darkOrange";
                ctx.font = "64px r0";
                ctx.textAlign = "center";
                ctx.fillText("Paused", gameWidth / 2, gameHeight / 2 - 28);
                drawBtn(ctx, resumeBtn);
            }),
            drawGameDead = gameOverlayDrawer(function (ctx, game) {
                var startY = 105;

                // 'Game Over' text
                ctx.fillStyle = starfieldActive ? "royalblue" : "darkOrange";
                ctx.font = "bold italic 90px i0";
                ctx.textAlign = "center";
                ctx.fillText("Game", gameWidth / 2 - 4, startY);
                ctx.fillText("Over", gameWidth / 2 - 4, startY + 75);

                // Points big
                ctx.font = "140px r0";
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
                ctx.font = "bold italic 28px i0";
                ctx.fillText("Highscores", gameWidth / 2, startY + 300);
                var scoreFontSize = 24;
                ctx.font = scoreFontSize + "px r0";
                var curY = startY + 325;
                highscores.highest().forEach(function (score) {
                    if (!score) { return; }
                    ctx.fillText(score, gameWidth / 2, curY);
                    curY += scoreFontSize + 2;
                });

                // Replay btn
                drawBtn(ctx, replayBtn);
            });
        return {
            menu: drawMenu,
            game: drawGame,
            gamePaused: drawGamePaused,
            gameDead: drawGameDead,
            btnLayer: redrawBtnLayer,
            tutorial: drawTutorial,
            background: drawMovingBg
        };
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
    var Collision = {
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
            return Collision.playerWheel_circle(player, x, y, circleRadius)
                || (!player.ducking && distLT(player.x, player.y - playerWheelToHeadDist, x, y, playerHeadRadius + circleRadius));
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
            var cy = player.y - playerTorsoLen  * 0.8;
            return distLT(player.x, cy, x, y, approxRadius + circleRadius);
        },
        playerHeadNearFb: function (player, fb) {
            var headWithMargin = playerHeadRadius + 10;
            // Add a margin of 10 so he ducks a little early.
            return distLT(player.x, player.y - playerWheelToHeadDist, fb.x, fb.y, headWithMargin + fbRadius);
        },
        player_fb: function (player, fb) {
            return Collision.playerHead_circle(player, fb.x, fb.y, fbRadius)
                || Collision.playerTorso_circle(player, fb.x, fb.y, fbRadius);
        },
        player_coin: function (player, coin) {
            return Collision.player_circle(player, coin.x, coin.y, coinRadius);
        },
        player_powerup: function (player, powerup) {
            return Collision.player_circle(player, powerup.xPos(), powerup.yPos(), activePowerupBubbleRadius);
        }
    };

    // Other small gameplay functions:
    var maybeGetPlatfmFromTouch = function (touch, success) {
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
        // 'fb' is short for 'fireball'
        updateFbsGeneric = (function () {
            var fewInLowerPortion = function (fbArray) {
                // Predicate asks: are there few enough fbs in bottom
                // of screen that more should be made?
                var i, fb;
                for (i = 0; i < fbArray.length; i += 1) {
                    fb = fbArray[i];
                    if (fb.y > gameHeight * 3 / 4) {
                        return false;
                    }
                }
                return true;
            };
            return function (obj, dt) {
                // Can be passed a menu object or game object, and
                // thus is not directly placed in gUpdaters.
                obj.fbs.forEach(function (fb, index) {
                    fb.y -= fbRiseRate * dt;
                    if (fb.y < -totalFbHeight - 20) {
                        obj.fbs.splice(index, 1);
                    }
                    fb.frame += 1;
                    if (fb.frame >= fbNumRecordedFrames) {
                        fb.frame = 0;
                    }
                });
                var chanceFactor = 4 / 7;
                if (Math.random() < 1 / 7000 * chanceFactor * dt || fewInLowerPortion(obj.fbs)) {
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
        // of points gotten from just time spent in the game. Doing it based
        // on this and not straight points prevents clear jumps in difficulty
        // after getting a bunch of coins at once, and not on straight time
        // playing so that people struggling at the top of the screen don't
        // get overwhelmed too quickly.
        difficultyCurveFromTimePoints = function (x) {
            x = Math.max(x, 0); // Just in case (i.e. strongly avoiding NaN)
            return x < 20 ? 0.8 :
                   // x < 50 ? same as below :
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
    var gUpdaters = (function () {
            // Some util first:
            var addToActivePowerups = function (game, type, x, y) {
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

                addDiagCoinPattern = function (game, do_rtl, eachCoinValue) {
                    // If do_rtl is truthy, the diag pattern
                    // will go down-and-left from the right.
                    var column, xPos, newcoin;
                    var groupId = game.nextCoinGroupId;
                    var coinsCreated = 0;
                    game.nextCoinGroupId += 1;
                    for (column = 0; column < coinColumnsStd; column += 1) {
                        xPos = (column + 0.5) * coinColWidthStd;
                        if (do_rtl) { xPos = gameWidth - xPos; }
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
                setBounceVelForPlatfm = function (platfm, uncurvedDt) {
                    var platfmSlope = (platfm.y1 - platfm.y0) / (platfm.x1 - platfm.x0);
                    platfm.bounceVx = Math.sign(platfmSlope) * 3.2;
                    platfm.bounceVy = Math.abs(platfmSlope) * 3.2 - platfmBounciness * uncurvedDt;
                    platfm.bounceSpeed = dist(0, 0, platfm.bounceVx, platfm.bounceVy);
                },
                die = function (game) {
                    if (game.dead) { return; }
                    game.dead = true;
                    if (game.previewPlatfmTouch) {
                        game.previewPlatfmTouch = Touch.copy(game.previewPlatfmTouch); // This means that when the player dies, when he/she moves the touch it doens't effect the preview.
                    }
                    Render.btnLayer(game);
                };
            return {
                player: function (game, realDt, dt, uncurvedDt) {
                    var i, platfm, playerSpeed, collided = false;
                    if (game.previewPlatfmTouch && Collision.player_platfm(game.player, game.previewPlatfmTouch)) {
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
                    // recently created platfms take precedence
                    for (i = game.platfms.length - 1; i >= 0; i -= 1) {
                        platfm = game.platfms[i];
                        if (Collision.player_platfm(game.player, platfm)) {
                            collided = true;
                            if (!playerSpeed) {
                                playerSpeed = quickSqrt(game.player.magnitudeSquared());
                            }
                            if (!platfm.bounceVx) {
                                setBounceVelForPlatfm(platfm, uncurvedDt);
                            }
                            game.player.vx = platfm.bounceVx;
                            game.player.vy = platfm.bounceVy;
                            if (platfm.bounceSpeed > playerSpeed + 2) {
                                game.player.vx *= (playerSpeed + 2) / platfm.bounceSpeed;
                                game.player.vy *= (playerSpeed + 2) / platfm.bounceSpeed;
                            }
                            game.player.vy -= platfmRiseRate * realDt;
                            break;
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
                        if (game.player.ducking === false && Collision.playerHeadNearFb(game.player, game.fbs[i])) {
                            game.player.ducking = true;
                        }
                        if (Collision.player_fb(game.player, game.fbs[i])) {
                            die(game);
                        }
                    }
                    var curCoinValue = handleActivesPoints(game.activePowerups, coinValue * difficultyCurveFromTimePoints(game.points - game.pointsFromCoins));
                    game.coins.forEach(function (coin, index) {
                        if (Collision.player_coin(game.player, coin)) {
                            if (Number.isFinite(coin.groupId) && game.coinGroups.hasOwnProperty(coin.groupId)) {
                                game.coinGroups[coin.groupId] -= 1;
                                if (game.coinGroups[coin.groupId] <= 0) {
                                    delete game.coinGroups[coin.groupId];
                                    game.points += game.coinGroupBonuses[coin.groupId];
                                    delete game.coinGroupBonuses[coin.groupId];
                                    game.coinGroupGottenNotifs.push({
                                        x: game.player.x,
                                        y: game.player.y,
                                        x0: game.player.x,
                                        y0: game.player.y,
                                        t0: Date.now()
                                    });
                                }
                            }
                            game.coins.splice(index, 1);
                            game.points += curCoinValue;
                            game.pointsFromCoins += curCoinValue; // Needs to be kept track of for difficulty curve, which is not affected by coin points
                        }
                    });
                    game.coinGroupGottenNotifs.forEach(function (notif, i) {
                        if (Date.now() - notif.t0 > 1000) {
                            return game.coinGroupGottenNotifs.splice(i, 1);
                        }
                        var dx = 0.02 * dt;
                        var dy = -(coinRiseRate + 0.03) * dt;
                        if (notif.x0 > gameWidth * 0.5) {
                            dx *= -1;
                        }
                        notif.x += dx;
                        notif.y += dy;
                    });
                    game.powerups.forEach(function (powerup, key) {
                        if (Collision.player_powerup(game.player, powerup)) {
                            game.powerups[key] = null;
                            addToActivePowerups(game, powerup.type, powerup.xPos(), powerup.yPos());
                        }
                    });
                    game.player.x = modulo(game.player.x + game.player.vx * uncurvedDt / 20, gameWidth);
                    game.player.y += game.player.vy * uncurvedDt / 20;
                    game.player.wheelAngle += Math.sign(game.player.vx) * 0.22 * uncurvedDt;
                },
                fbs: updateFbsGeneric,
                coins: function (game, dt) {
                    var magnetOn = powerupObtained(game.activePowerups, "magnet");
                    var dy = coinRiseRate * dt;
                    // The coins are all rendered in a vertically sliding
                    // grid, and coinGridOffset keeps track of the distance
                    // to the bottom on-screen invisible line of that grid
                    // from the base of the screen.
                    game.coinGridOffset += dy;
                    game.coinGridOffset = game.coinGridOffset % coinColWidthStd;
                    game.coins.forEach(function (coin, index) {
                        coin.y -= dy;
                        var distanceSqd;
                        var distance;
                        if (magnetOn) {
                            distanceSqd = coin.distanceSqdTo(game.player);
                            if (distanceSqd < 100 * 100) {
                                distance = quickSqrt(distanceSqd);
                                coin.setDistanceTo(game.player, distance - (100 / distance));
                            }
                        }
                        if (coin.y < -2 * coinRadius) {
                            if (Number.isFinite(coin.groupId)) {
                                delete game.coinGroups[coin.groupId];
                                delete game.coinGroupBonuses[coin.groupId];
                                // Since a coin has escaped, the group data
                                // can be discarded entirely.
                            }
                            game.coins.splice(index, 1);
                        }
                    });
                    // Release modes are: "random", "blocks", "diagLTR", "diagRTL"
                    var curCoinValue = handleActivesPoints(game.activePowerups, coinValue * difficultyCurveFromTimePoints(game.points - game.pointsFromCoins));
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
                    game.platfms.forEach(function (platfm, index) {
                        platfm.y0 -= platfmRiseRate * dt;
                        platfm.y1 -= platfmRiseRate * dt;
                        platfm.time_left -= dt;
                        if (platfm.time_left <= 0) {
                            game.platfms.splice(index, 1);
                        }
                    });
                },
                powerups: function (game, dt) {
                    game.powerups.forEach(function (powerup, key) {
                        powerup.lifetime += dt;
                        if (powerup.xPos() > gameWidth + activePowerupBubbleRadius + playerRadius) {
                            // The active powerup bubble is larger than all powerups,
                            // and the '+ playerRadius' is so that he can catch one
                            // just as it disappears.
                            game.powerups[key] = null;
                        }
                    });
                    var chanceFactor = 1 / 75000;
                    if (!game.powerups.X2 && Math.random() < chanceFactor * dt) { // 100 times less frequent than fireballs
                        game.powerups.X2 = makePowerupRandom("X2", 25, 145);
                    }
                    if (!game.powerups.slow && Math.random() < chanceFactor * dt) {
                        game.powerups.slow = makePowerupRandom("slow", 25, 145);
                    }
                    if (!game.powerups.weight && game.points > 50 && Math.random() < chanceFactor * dt) {
                        game.powerups.weight = makePowerupRandom("weight", 25, 145);
                    }
                    if (!game.powerups.magnet && Math.random() < chanceFactor * dt) {
                        game.powerups.magnet = makePowerupRandom("magnet", 25, 145);
                    }
                },
                activePowerups: function (game, dt) {
                    game.activePowerups.forEach(function (activePowerup, index) {
                        if (activePowerup.lifetime <= 0) {
                            game.activePowerups.splice(index, 1);
                        }
                        activePowerup.lifetime -= dt;
                        if (activePowerup.timeSinceAcquired < activePowerupTravelTime) {
                            activePowerup.timeSinceAcquired += dt;
                        }
                    });
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
                        // If not reset previewPlatfmTouch, then when the user
                        // lifts finger at same time preview is hit by player,
                        // two platfms would be created at that position.
                    });
                }
            },
            handleDocumentClick: function (game, event, restart, disallowPause) {
                var q = calcTouchPos(event);
                var p = {
                    x1: q.x,
                    y1: q.y
                };
                if (game.paused) {
                    if (resumeBtn.touchIsInside(p)) {
                        game.paused = false;
                        requestAnimationFrame(function () {
                            return Render.btnLayer(game);
                        });
                    }
                } else if (game.dead) {
                    if (replayBtn.touchIsInside(p)) {
                        restart();
                    }
                } else if (!disallowPause && pauseBtn.touchIsInside(p)) {
                    game.paused = true;
                    requestAnimationFrame(function () {
                        return Render.btnLayer(game);
                    });
                }
            },
            handleBtnLayerUpdates: (function () {
                var sensitivityMarginY = 40, // Margin around button for events to trigger redraws on, so that a release is registered when the user slides a finger off the button
                    sensitivityMarginX = 70; // People do faster horizontal swipes, so a larger margin is necessary
                return function (game, event, lastRedraw) {
                    // This should handle all of: touchmove, touchstart, touchend
                    var now = Date.now(),
                        dt = now - lastRedraw,
                        touch = calcTouchPos(event);
                    if (dt > 30 && // To prevent way-too-inefficiently-frequent rerendering
                            touch.x > pauseBtn.edgeX() - sensitivityMarginX &&
                            touch.y < pauseBtn.y + pauseBtn.h + sensitivityMarginY) {
                        requestAnimationFrame(function () {
                            return Render.btnLayer(game);
                        });
                        return now; // Tell caller last redraw happened at 'now'
                    }
                    return lastRedraw; // Tell caller the time of the last redraw hasn't changed
                };
            }())
        };

    // Update/render loops of home menu and gameplay:
    var play = function (existingGame) {
            var game = existingGame || createGame(),
                restart = function () {
                    game = createGame();
                    setCurGame(game);
                    Render.btnLayer(game);
                },
                prevFrameTime = performance.now() - approxFrameLen,
                startTime = performance.now();
            setCurGame(game);
            window.deltas = window.deltas || [];

            requestAnimationFrame(function runFrame(now) {
                window.game = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.

                requestAnimationFrame(runFrame);

                // Initialize time deltas
                var realDt = now - prevFrameTime;
                if (!game.paused && !game.dead) {
                    if (startTime !== now) {
                        // To prevent the first time delta (manufactured to
                        // always be approxFrameLen) from confusing the data
                        window.deltas.push(realDt);
                    }
                }

                game.statsPrev = game.stats;
                game.stats = {};

                game.stats.literalTimeDiff = realDt;
                // Cap realDt at 3 times the normal frame length to prevent
                // a large noticable jump in on-screen objects:
                realDt = Math.min(realDt, approxFrameLen);

                game.stats.diffCurve = difficultyCurveFromTimePoints(game.points - game.pointsFromCoins);
                var uncurvedDt = realDt;
                realDt *= game.stats.diffCurve;
                if (realDt < 0 || !Number.isFinite(realDt)) {
                    // I have reason to believe that this situation may be a cause
                    // (or link in a chain of causes) for an error.
                    // If this ever happens, something went very wrong, so avoid
                    // anything further and hope it was just for that frame.
                    realDt = approxFrameLen;
                    localStorage.setItem("error_log", (localStorage.getItem("error_log") || "") + "\n,\n" + JSON.stringify({t: Date.now(), game: game}) + '\n,"realDt is ' + realDt + " of type" + (typeof realDt) + '"');
                    console.log("realDt toxic. info added to error_log at " + Date.now());
                }
                game.stats.realDt = realDt;


                // Handle effects of slow powerup
                var dt;
                if (powerupObtained(game.activePowerups, "slow")) {
                    dt = realDt * 2/3;
                    uncurvedDt *= 2/3;
                    // Any functions given 'dt' as the time delta will thus
                    // behave as if 2/3 as much time has passed.
                } else {
                    dt = realDt;
                }
                game.stats.dt = dt;
                game.stats.prevFrameTime = prevFrameTime;
                game.stats.now = now;
                game.stats.startingFramePoints = game.points;
                prevFrameTime = now;

                Render.background(!game.paused && !game.dead);
                if (game.paused) {
                    Render.gamePaused(game);
                } else if (game.dead) {
                    Render.gameDead(game);
                } else {
                    // Update state
                    game.previewPlatfmTouch = Touch.curTouch;
                    gUpdaters.player(game, realDt, dt, Math.min(dt, uncurvedDt * 0.83));
                    gUpdaters.coins(game, dt);
                    gUpdaters.fbs(game, dt);
                    gUpdaters.platfms(game, dt);
                    gUpdaters.powerups(game, dt);
                    gUpdaters.activePowerups(game, dt);
                    game.points += handleActivesPoints(game.activePowerups, timeBasedPointsVanilla(game.player.y, realDt));
                    // Because timeBasedPointsVanilla takes 'realDt', when the
                    // slow powerup is held, points still flow in at the normal
                    // speed from the user's perspective.

                    game.points = Math.max(0, game.points);
                    // Although a user floating above the top of the screen
                    // should lose points, negative points don't make sense.

                    if (game.dead) {
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
            };
            document.body.onclick = function (event) {
                gEventHandlers.handleDocumentClick(game, event, restart);
            };
            Render.btnLayer(game);
            document.body.ontouchmove =
                document.body.ontouchstart =
                document.body.ontouchend =
                document.body.onmousedown =
                document.body.onmousemove =
                document.body.onmouseup = (function () {
                    var lastRedraw = Date.now();
                    return function (event) {
                        lastRedraw = gEventHandlers.handleBtnLayerUpdates(game, event, lastRedraw);
                    };
                }());
        },
        createAutomatedTouch = function (dir) {
            var autoTouchStartY = 230,
                autoTouchStartXDiff = gameWidth * 0.3;
            var x = gameWidth / 2 + dir * autoTouchStartXDiff;
            return {
                x0: x,
                y0: autoTouchStartY,
                x1: x,
                y1: autoTouchStartY
            };
        },
        stepAutomatedTouch = function (autoTouch) {
            if (autoTouch.x0 > gameWidth / 2) {
                autoTouch.x1 -= 1.4 * 5;
            } else {
                autoTouch.x1 += 1.4 * 5;
            }
            autoTouch.y1 += 1 * 5;
        },
        timeBetweenAutoTouches = 600,
        runTutorial = function () {
            var game = createGame(),
                prevFrameTime = performance.now() - approxFrameLen,
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
                startRealGame = function () {
                    document.body.onclick = function () {};
                    play(game);
                },
                realGameReady = false,
                restartTut = function () {
                    game = createGame();
                    curAutomatedTouch = createAutomatedTouch(autoTouchDir);
                };
            var prevX, prevY, midwayX, midwayY;
            requestAnimationFrame(function runFrame(now) {
                if (realGameReady) {
                    return startRealGame();
                }
                requestAnimationFrame(runFrame);

                window.tutorial = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.

                // Initialize time delta
                var dt = now - prevFrameTime;
                // Cap dt at 3 times the normal frame length to prevent
                // a large noticable jump in on-screen objects:
                dt = Math.min(dt, approxFrameLen);

                var uncurvedDt = dt;
                dt *= difficultyCurveFromTimePoints(0);

                prevFrameTime = now;

                Render.background(!game.paused && !game.dead);
                if (game.paused) {
                    Render.gamePaused(game);
                } else if (game.dead) {
                    Render.gameDead(game);
                } else {
                    // Update state
                    gUpdaters.player(game, dt, dt, uncurvedDt * 0.83);
                    gUpdaters.platfms(game, dt);
                    if (Touch.curTouch) {
                        materializeAutoTouch();
                        realGameReady = true;
                    }
                    if (curAutomatedTouch.y1 > 290) {
                        materializeAutoTouch();
                    } else if (interTouchWait <= 0) {
                        stepAutomatedTouch(curAutomatedTouch);
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
            };
            document.body.onclick = function (event) {
                gEventHandlers.handleDocumentClick(game, event, restartTut, true);
            };
            // Not adding events for handleBtnLayerUpdates because the pause
            // btn is not drawn in tutorial.
        },
        createMenu = function () {
            return {
                fbs: [],
                firebitsRed: [],
                firebitsOrg: []
            };
        },
        runMenu = function () {
            var menu = createMenu(),
                prevFrameTime = performance.now() - approxFrameLen,
                startGame = function () {
                    document.body.onclick = function () {};
                    Touch.onTouchend = null;
                    runTutorial();
                },
                playPressed = false;
            window.menu = menu;
            requestAnimationFrame(function runFrame(now) {
                if (playPressed) {
                    return startGame();
                }
                requestAnimationFrame(runFrame);
                var dt = now - prevFrameTime;
                prevFrameTime = now;
                updateFbsGeneric(menu, dt * 0.83);
                Render.background(true);
                Render.menu(menu);
            });
            document.body.onclick = function (event) {
                var pos = calcTouchPos(event), tpos = {x1: pos.x, y1: pos.y};
                if (menuPlayBtn.touchIsInside(tpos)) {
                    playPressed = true;
                }
            };
            Touch.onTouchend = gEventHandlers.handleTouchendForThemeSwitch;
        };
    runMenu();
}());