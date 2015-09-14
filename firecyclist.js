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
            return Math.sqrt(distanceSquared(x0, y0, x1, y1));
        },
        distLT = function (x0, y0, x1, y1, compareWith) {
            var distSquared = distanceSquared(x0, y0, x1, y1);
            return distSquared < compareWith * compareWith;
        },
        signNum = function (num) {
            return num > 0 ? 1 :
                   num < 0 ? -1 :
                   0;
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
        }());

    // Config:
    var canvasBackground = "rgb(153, 217, 234)", // Same color used in CSS
        fps = 40,
        playerGrav = 0.32 / 28,
        fbRiseRate = 0.1,
        fbRadius = 10,
        coinRiseRate = 0.1,
        coinRadius = 10,
        coinSquareLen = 8.5,
        coinValue = 11,
        coinStartingY = gameHeight + coinRadius,
        platfmRiseRate = 0.15,
        totalFbHeight = 10,
        platfmBounciness = 0.75,
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
        inGamePointsYPos = 39,
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
        powerupSlowRadius = 10,
        powerupWeightScaleUnit = 0.8,
        powerupWeightHandleHeight = 4,
        powerupWeightBlockUpperXMargin = 4,
        powerupWeightBlockLowerWidth = 32,
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
        var offScreenRender = function (width, height, render) {
                var newCanvas = document.createElement('canvas');
                newCanvas.width = width;
                newCanvas.height = height;
                render(newCanvas.getContext('2d'), width, height);
                return newCanvas;
            },
            objIsVisible = function (xradius, obj) {
                return obj.x > -xradius && obj.x < gameWidth + xradius;
            };
        // Renderers:
        var fillShadowyText = function (ctx, text, x, y, reverse, offsetAmt, w, h) {
                // Doesn't set things like ctx.font and ctx.textAlign so that they
                // can be set on ctx by the caller, before invoking.
                var clr0 = reverse ? "black" : "darkOrange",
                    clr1 = reverse ? "darkOrange" : "black",
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
            wheelOutlineAt = function (ctx, x, y) {
                // Wheel outline is drawn in two solid parts to get around
                // Chrome-for-Android rendering bug.
                var style = ctx.fillStyle;
                ctx.beginPath();
                circleAt(ctx, x, y, playerRadius);
                ctx.fillStyle = "black";
                ctx.fill();

                ctx.beginPath();
                circleAt(ctx, x, y, playerRadius - 1);
                ctx.fillStyle = canvasBackground;
                ctx.fill();

                ctx.fillStyle = style;
            },
            drawPlayerDuckingAt = function (ctx, x, y, wheelAngle) {
                wheelOutlineAt(ctx, x, y);

                ctx.beginPath();

                var playerHeadX = x + playerDuckingXDiff;
                var playerHeadY = y + playerDuckingYDiff;

                // Torso:
                var torsoStartX = playerHeadX + sqrt3 / 2 * playerHeadRadius;
                var torsoStartY = playerHeadY + 0.5 * playerHeadRadius;
                var torsoMidX = torsoStartX + 5;
                var torsoMidY = torsoStartY + 2;
                ctx.moveTo(torsoStartX, torsoStartY);
                ctx.lineTo(torsoMidX, torsoMidY);
                ctx.lineTo(x, y);

                // One arm (shadowed by head):
                ctx.moveTo(torsoMidX, torsoMidY);
                ctx.lineTo(torsoMidX - 1, playerHeadY - playerHeadRadius * 0.65);
                ctx.lineTo(playerHeadX - playerHeadRadius * 1.4, playerHeadY - playerHeadRadius + 4);

                // Spokes of wheel:
                wheelSpokesAt(ctx, x, y, wheelAngle);

                ctx.stroke();


                // Solid, background-colored body of head, with slight extra radius for outline:
                var style = ctx.fillStyle;
                ctx.beginPath();
                ctx.fillStyle = canvasBackground;
                circleAt(ctx, playerHeadX, playerHeadY, playerHeadRadius + 1);
                ctx.fill();
                ctx.fillStyle = style;

                // Now for the lines to appear in front of head:

                ctx.beginPath();

                // Outline of head:
                circleAt(ctx, playerHeadX, playerHeadY, playerHeadRadius);

                // Final arm (not shadowed by head):
                ctx.moveTo(torsoMidX, torsoMidY);
                ctx.lineTo(x, playerHeadY);
                ctx.lineTo(x - playerHeadRadius - 3, playerHeadY + 3);

                ctx.stroke();
            },
            drawPlayerAt = function (ctx, x, y, wheelAngle) {
                wheelOutlineAt(ctx, x, y);

                ctx.beginPath();

                // Head and torso:
                circleAt(ctx, x, y - playerWheelToHeadDist, playerHeadRadius);
                ctx.moveTo(x, y - playerTorsoLen - playerRadius);
                ctx.lineTo(x, y); // (x, y) is the center of the wheel

                // Wheel spokes:
                wheelSpokesAt(ctx, x, y, wheelAngle);

                // Arms:
                ctx.save();
                ctx.translate(x, y - playerRadius - playerTorsoLen / 2);
                oneArm(ctx);
                oneArm(ctx, true);
                ctx.restore();

                ctx.stroke();
            },
            drawFbs = function (ctx, fbs) {
                ctx.beginPath();
                fbs.forEach(function (fb) {
                    if (objIsVisible(2 * fbRadius, fb)) {
                        circleAt(ctx, fb.x, fb.y, fbRadius);
                    }
                });
                ctx.fillStyle = "orange";
                ctx.fill();
            },
            drawFirebits = function (ctx, firebits, color) {
                var i;
                ctx.fillStyle = color;
                for (i = 0; i < firebits.length; i += 1) {
                    if (objIsVisible(1.4, firebits[i])) {
                        ctx.fillRect(firebits[i].x, firebits[i].y, 2.5, 2.5);
                    }
                }
            },
            drawCoins = function (ctx, coins) {
                var i;
                if (coins.length === 0) { return; }
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (i = 0; i < coins.length; i += 1) {
                    if (objIsVisible(2 * coinRadius, coins[i])) {
                        circleAt(ctx, coins[i].x, coins[i].y, coinRadius);
                    }
                }
                ctx.fillStyle = "yellow";
                ctx.fill();
                ctx.strokeStyle = "orange";
                ctx.stroke();

                ctx.fillStyle = "darkOrange";
                for (i = 0; i < coins.length; i += 1) {
                    if (objIsVisible(2 * coinRadius, coins[i])) {
                        ctx.fillRect(coins[i].x - coinSquareLen / 2, coins[i].y - coinSquareLen / 2, coinSquareLen, coinSquareLen);
                    }
                }

                for (i = 0; i < coins.length; i += 1) {
                    if (objIsVisible(2 * coinRadius, coins[i])) {
                        // strokeStyle is still "orange"
                        ctx.strokeRect(coins[i].x - coinSquareLen / 2, coins[i].y - coinSquareLen / 2, coinSquareLen, coinSquareLen);
                    }
                }
            },
            setupGenericPlatfmChars = function (ctx) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = platfmThickness;
                ctx.lineCap = "round";
                ctx.lineJoin = "smooth";
            },
            drawPlatfm = function (ctx, p) { // Must be run after setupGenericPlatfmChars
                ctx.beginPath();
                ctx.globalAlpha = Math.max(0, p.time_left / 1000);
                ctx.moveTo(p.x0, p.y0);
                ctx.lineTo(p.x1, p.y1);
                ctx.stroke();
            },
            drawPreviewPlatfm = function (ctx, touch) { // Must be run after setupGenericPlatfmChars
                ctx.beginPath();
                ctx.strokeStyle = "grey";
                ctx.moveTo(touch.x0, touch.y0);
                ctx.lineTo(touch.x1, touch.y1);
                ctx.stroke();
            },
            drawInGamePoints = function (ctx, game) {
                if (!game.dead) {
                    ctx.textAlign = "left";
                    ctx.font = "bold " + inGamePointsPxSize + "px r0";
                    fillShadowyText(ctx, Math.floor(game.points), 16, inGamePointsYPos);
                }
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
                        ctx.globalAlpha = 0.7;
                        circle(ctx, cx, cy, powerupSlowRadius, "silver", "fill");
                        ctx.globalAlpha = 1;
                        ctx.lineWidth = 3;
                        circle(ctx, cx, cy, powerupSlowRadius, "gray", "stroke");
                        ctx.beginPath();
                        lineFromTo(ctx, cx, cy, cx, cy - powerupSlowRadius * 0.75);
                        lineFromTo(ctx, cx, cy, cx + powerupSlowRadius * 0.75, cy);
                        ctx.stroke();
                    }),
                    "weight": offScreenRender(powerupWeightBlockLowerWidth, powerupWeightHeight, function (ctx, w, fullHeight) {
                        var cx = w / 2, cy = fullHeight / 2;
                        var blockHeight = powerupWeightBlockHeight;
                        var handleHeight = powerupWeightHandleHeight;

                        // Solid black block:
                        ctx.beginPath();
                        ctx.moveTo(powerupWeightBlockUpperXMargin, handleHeight);
                        ctx.lineTo(w - powerupWeightBlockUpperXMargin, handleHeight);
                        ctx.lineTo(w, handleHeight + blockHeight);
                        ctx.lineTo(0, fullHeight);
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
                        ctx.font = "bold 28px Courier New";
                        ctx.fillStyle = "lightGrey";
                        ctx.textAlign = "center";
                        ctx.fillText("1000", cx, fullHeight - 1, 24);
                    }),
                    "magnet": offScreenRender(powerupSlowRadius * 3, powerupSlowRadius * 3, function (ctx, w, h) {
                        var x = w / 2, y = h / 2;
                        ctx.beginPath();
                        ctx.arc(x, y, powerupSlowRadius, 0, Math.PI, true);
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 10;
                        ctx.stroke();
                        ctx.fillStyle = "red";
                        ctx.fillRect(x - powerupSlowRadius - 5, y, 10, 5);
                        ctx.fillRect(x + powerupSlowRadius - 5, y, 10, 5);
                        ctx.fillStyle = "white";
                        ctx.fillRect(x - powerupSlowRadius - 5, y + 5, 10, 6);
                        ctx.fillRect(x + powerupSlowRadius - 5, y + 5, 10, 6);
                    })
                };
                return function (ctx, type, x, y) {
                    var canvas = canvases[type];
                    ctx.drawImage(canvas, x - canvas.width / 2, y - canvas.height / 2);
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
                var xPos = activePowerupsStartingXPos, yPos = inGamePointsYPos - 9, i;
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
                    shadow: "rgba(133, 133, 171, 0.7)",
                    btn: "rgba(158, 158, 200, 1)"
                };
                var tintedClrs = {
                    shadow: "rgba(178, 148, 138, 0.7)",
                    btn: "rgba(215, 188, 173, 1)"
                };
                return function (ctx, edgeX, edgeY, width, height, pressed, reddish, radius) {
                    var clrs = reddish ? tintedClrs : stdClrs;
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
            drawPauseBars = function (ctx, y, btn) {
                var leftX = btn.edgeX() + 9 + btn.textXOffset;
                var barsY = y + 9;
                var barW = btn.w / 4 - 2 + btn.textWDiff;
                var barH = btn.h + btn.textHDiff;
                ctx.fillRect(leftX, barsY, barW, barH);
                ctx.fillRect(leftX + barW * 5 / 3, barsY, barW, barH);
            },
            drawBtn = function (ctx, btn) {
                var pressed = Touch.curTouch && btn.touchIsInside(Touch.curTouch);
                drawButtonStructureAt(ctx, btn.edgeX(), btn.y, btn.w, btn.h, pressed, btn.tintedRed);
                var x = btn.x, y = btn.y;
                if (pressed) {
                    x -= btnShadowOffset;
                    y += btnShadowOffset;
                }
                ctx.fillStyle = btn.tintedRed ? "rgb(175, 145, 125)" : "rgb(120, 120, 130)";
                if (btn.text === ":pause") {
                    drawPauseBars(ctx, y, btn);
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
            drawCloudBg = (function () {
                var cloudImg = new Image(), cloudPattern;
                cloudImg.onload = function () {
                    cloudPattern = bgCtx.createPattern(cloudImg, "repeat");
                    bgCtx.fillStyle = cloudPattern;
                };
                cloudImg.src = "img/bg-clouds.jpg";
                var xOffset = 0, yOffset = 0;
                return function () {
                    xOffset = modulo(xOffset, cloudImg.width);
                    yOffset = modulo(yOffset, cloudImg.height);
                    if (cloudPattern) {
                        bgCtx.save();
                        bgCtx.translate(-xOffset, -yOffset);
                        bgCtx.fillRect(0, 0, gameWidth * 6, gameHeight * 4);
                        bgCtx.restore();
                        xOffset += 0.1;
                        yOffset += 0.02;
                    }
                };
            }()),
            drawMenu = function (menu) {
                drawCloudBg();
                mainCtx.clearRect(0, 0, gameWidth, gameHeight);
                drawFbs(mainCtx, menu.fbs);
                drawFirebits(mainCtx, menu.firebitsRed, "red");
                drawFirebits(mainCtx, menu.firebitsOrg, "darkOrange");
                drawMenuTitle(mainCtx);
                drawBtn(mainCtx, menuPlayBtn);
            },
            drawGame = function (game) {
                drawCloudBg();
                mainCtx.save();
                mainCtx.clearRect(0, 0, gameWidth, gameHeight);
                overlayCtx.clearRect(0, 0, gameWidth, gameHeight);
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
                drawFbs(mainCtx, game.fbs);
                drawFirebits(mainCtx, game.firebitsRed, "red");
                drawFirebits(mainCtx, game.firebitsOrg, "darkOrange");
                drawCoins(mainCtx, game.coins);
                game.powerups.forEach(function (powerup) {
                    drawPowerup(mainCtx, powerup.type, powerup.xPos(), powerup.yPos());
                });
                drawActivePowerups(mainCtx, game.activePowerups);
                drawInGamePoints(mainCtx, game);
                mainCtx.restore();
            },
            drawTutorialHand = function (ctx, x, y) {
                ctx.font = "80px r0";
                ctx.fillStyle = "tan";
                ctx.fillText("☚", x + 36, y + 36);
                ctx.strokeStyle = "brown";
                ctx.lineWidth = 3;
                ctx.strokeText("☚", x + 36, y + 36);
            },
            drawSwipeHelpText = (function () {
                var t0 = "Swipe to draw",
                    t1 = "platforms";
                return function (ctx, x, y) {
                    var helpTextPxSize = 25;
                    ctx.font = "italic " + helpTextPxSize + "px i0";
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = "tan";
                    ctx.strokeText(t0, x, y);
                    ctx.strokeText(t1, x, y + helpTextPxSize);
                    ctx.fillStyle = "brown";
                    ctx.fillText(t0, x, y);
                    ctx.fillText(t1, x, y + helpTextPxSize);
                };
            }()),
            drawTutorial = function (game, handX, handY) {
                drawCloudBg();
                mainCtx.save();
                mainCtx.clearRect(0, 0, gameWidth, gameHeight);
                overlayCtx.clearRect(0, 0, gameWidth, gameHeight);
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
                    ctx.fillStyle = "rgba(200, 200, 200, 0.75)";
                    ctx.fillRect(0, 0, gameWidth, gameHeight);
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
                ctx.fillStyle = "darkOrange";
                ctx.font = "64px r0";
                ctx.textAlign = "center";
                ctx.fillText("Paused", gameWidth / 2, gameHeight / 2 - 28);
                drawBtn(ctx, resumeBtn);
            }),
            drawGameDead = gameOverlayDrawer(function (ctx, game) {
                var startY = 105;

                // 'Game Over' text
                ctx.fillStyle = "darkOrange";
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
                ctx.strokeStyle = "darkOrange";
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
            tutorial: drawTutorial
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

    // Vector and line util:
    var anglify = function (doCalc, f) {
            // If 'doCalc' is true, the object in question ('this') has
            //  properties x0, y0, x1, y1, and the anglify methods will
            //  DO the CALCulation of converting those to length deltas.
            // If 'doCalc' is false, the object has vx, vy properties.
            var proto = {
                angle: function () {
                    return doCalc ? Math.atan2(this.y1 - this.y0, this.x1 - this.x0)
                                  : Math.atan2(this.vy, this.vx);
                },
                magnitudeSquared: function () {
                    return doCalc ? distanceSquared(this.x0, this.y0, this.x1, this.y1)
                                  : (this.vx * this.vx + this.vy * this.vy);
                },
                slope: function () {
                    return doCalc ? (this.y1 - this.y0) / (this.x1 - this.x0)
                                  : this.vy / this.vx;
                }
            };
            if (!doCalc) {
                proto.setMagnitude = function (mag) {
                    var angle = this.angle();
                    this.vx = trig.cos(angle) * mag;
                    this.vy = trig.sin(angle) * mag;
                };
            }
            return function () {
                return makeObject(proto, f.apply(this, [].slice.apply(arguments)));
            };
        },
        createVel = anglify(false, function (vx, vy) {
            return {vx: vx, vy: vy};
        }),
        withAngularCtrls = (function () {
            var proto = {
                angleTo: function (xy) { // Currently unused, but as definition adds only constant time and may be useful in future, I'll leave it.
                    return Math.atan2(xy.y - this.y, xy.x - this.x);
                },
                distanceTo: function (xy) {
                    return dist(this.x, this.y, xy.x, xy.y);
                },
                setDistanceTo: function (xy, newd) {
                    var vectorFromPlayer = createVel(this.x - xy.x, this.y - xy.y),
                        newAbsoluteVector;
                    vectorFromPlayer.setMagnitude(newd);
                    newAbsoluteVector = createVel(xy.x + vectorFromPlayer.vx, xy.y + vectorFromPlayer.vy);
                    this.x = newAbsoluteVector.vx;
                    this.y = newAbsoluteVector.vy;
                }
            };
            return function (f) {
                return function () {
                    return makeObject(proto, f.apply(this, [].slice.apply(arguments)));
                };
            };
        }());

    // Constructors for in-game objects:
    var createPlayer = anglify(false, function (x, y, vx, vy) {
            return {x: x, y: y, vx: vx, vy: vy, wheelAngle: 0, ducking: false};
        }),
        createPlatfm = anglify(true, function (x0, y0, x1, y1) {
            return {x0: x0, y0: y0, x1: x1, y1: y1, time_left: 800};
        }),
        createCoin = withAngularCtrls(function (x, y) {
            return {x: x, y: y};
        }),
        createFb = function (x, y) {
            return {x: x, y: y};
        },
        createFirebit = function (x, y) {
            return {x: x, y: y, lifespan: 0};
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
                    coinColumnsLowest: [],
                    coinGridOffset: 0,
                    powerups: mkPowerupsObj({}),
                    activePowerups: [],
                    points: 0,
                    paused: false,
                    dead: false
                };
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
            if (player.x + rad < startx || player.x - rad > endx || player.y + rad < starty || player.y - rad > endy) {
                return false;
            }

            // Algorithm adapted from http://mathworld.wolfram.com/Circle-LineIntersection.html
            var offsetStartX = platfm.x0 - player.x,
                offsetStartY = platfm.y0 - player.y,
                offsetEndX = platfm.x1 - player.x,
                offsetEndY = platfm.y1 - player.y,
                platLengthSquared = distanceSquared(platfm.x0, platfm.y0, platfm.x1, platfm.y1),
                bigD = offsetStartX * offsetEndY - offsetEndX * offsetStartY;
            return rad * rad * platLengthSquared >= bigD * bigD;
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
        circle_rect: function (circX, circY, radius, rectX, rectY, rectWidth, rectHeight) { // Adapted from StackOverflow answer by 'e. James': http://stackoverflow.com/a/402010
            var distX = Math.abs(circX - rectX),
                distY = Math.abs(circY - rectY),
                cornerDist_squared;
            if (distX > (rectWidth/2 + radius) || distY > (rectHeight/2 + radius)) {
                return false;
            }
            if (distX <= (rectWidth/2) || distY <= (rectHeight/2)) {
                return true;
            }
            cornerDist_squared = Math.pow(distX - rectWidth/2, 2) +
                                 Math.pow(distY - rectHeight/2, 2);
            return cornerDist_squared <= (radius * radius);
        },
        player_rect: function (player, x, y, w, h) {
            var headY = player.y - playerWheelToHeadDist;
            return Collision.circle_rect(player.x, player.y, playerRadius, x, y, w, h)
                || (!player.ducking && Collision.circle_rect(player.x, headY, playerHeadRadius, x, y, w, h));
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
            if (powerup.type === "X2") {
                return Collision.player_rect(player, powerup.xPos(), powerup.yPos(), powerupX2Width, powerupX2Height);
            }
            if (powerup.type === "slow") {
                return Collision.player_circle(player, powerup.xPos(), powerup.yPos(), powerupSlowRadius);
            }
            if (powerup.type === "weight") {
                return Collision.player_rect(player, powerup.xPos(), powerup.yPos(), powerupWeightBlockLowerWidth, powerupWeightHeight);
            }
            if (powerup.type === "magnet") {
                return Collision.player_circle(player, powerup.xPos(), powerup.yPos(), powerupSlowRadius);
            }
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
            var // firebits: the little slivers that fall around a fireball
                makeFirebitAround = function (fbX, fbY) {
                    var relX = Math.random() * 2 * fbRadius - fbRadius,
                        absoluteX = fbX + relX,
                        // Now, place the y close to the top edge of the
                        // fireball with a quadratic approximation. See graph
                        // at http://wolfr.am/6LvgDMu~ for what I'm going for.
                        highestRelY = (fbRadius + 3) - relX * relX / 19,
                        relY = Math.random() * -highestRelY,
                        absoluteY = fbY + relY;
                    return createFirebit(absoluteX, absoluteY);
                },
                fewInLowerPortion = function (fbArray) {
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
                },
                updateFirebits = function (firebits, dt) {
                    firebits.forEach(function (firebit, index) {
                        firebit.y += Math.random() * 1.5 + 0.1;
                        firebit.x += Math.random() * 1.5 - 1;
                        firebit.lifespan += dt;
                        if (firebit.lifespan >= 100 && Math.random() < 0.3) {
                            firebits.splice(index, 1);
                        }
                    });
                };
            return function (obj, dt) {
                // Can be passed a menu object or game object, and
                // thus is not directly placed in gUpdaters.
                obj.fbs.forEach(function (fb, index) {
                    fb.y -= fbRiseRate * dt;
                    if (fb.y < -totalFbHeight) {
                        obj.fbs.splice(index, 1);
                    }
                    obj.firebitsRed.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsRed.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsRed.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsRed.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsRed.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    obj.firebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                });
                updateFirebits(obj.firebitsRed, dt);
                updateFirebits(obj.firebitsOrg, dt);
                var chanceFactor = 4 / 7;
                if (Math.random() < 1 / 1000 * chanceFactor * dt || fewInLowerPortion(obj.fbs)) {
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

        difficultyCurveFromPoints = function (x) {
            x = Math.max(x, 0); // Just in case (i.e. strongly avoiding NaN)
            return Math.log2(x + 100) / 37 + 0.67;
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
            var cappedDepth = Math.min(0.85, depth);
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
                addDiagCoinPattern = function (game, do_rtl) {
                    // If do_rtl is truthy, the diag pattern
                    // will go down-and-left from the right.
                    var columns = 8;
                    var column, xPos, newcoin;
                    for (column = 0; column < columns; column += 1) {
                        xPos = (column + 0.5) * 35;
                        if (do_rtl) { xPos = gameWidth - xPos; }
                        newcoin = createCoin(xPos, coinStartingY + column * 35);
                        game.coins.push(newcoin);
                        game.coinColumnsLowest[column] = newcoin;
                    }
                },
                velFromPlatfm = function (player, platfm) {
                    var slope = platfm.slope(),
                        cartesianVel = createVel(signNum(slope) * 3, Math.abs(slope) * 3 - platfmRiseRate * 25 - platfmBounciness),
                        calculatedMagSqd = cartesianVel.magnitudeSquared(),
                        playerMagSqd = player.magnitudeSquared();
                    cartesianVel.setMagnitude(Math.sqrt(Math.min(calculatedMagSqd, playerMagSqd)) + playerGrav * 25);
                    return cartesianVel;
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
                player: function (game, dt) {
                    var i, platfm, tmpVel, collided = false;
                    if (game.player.y > gameHeight + playerRadius) {
                        die(game);
                        // The frame finishes, with all other components also
                        // being updated before the GameOver screen apperas, so
                        // so does the player's position. This is why there is
                        // no 'return;' here.
                    }
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
                        });
                    }
                    for (i = 0; i < game.platfms.length; i += 1) {
                        platfm = game.platfms[i];
                        if (Collision.player_platfm(game.player, platfm)) {
                            tmpVel = velFromPlatfm(game.player, platfm);
                            game.player.vx = tmpVel.vx;
                            game.player.vy = tmpVel.vy;
                            collided = true;
                        }
                    }
                    if (!collided) {
                        if (powerupObtained(game.activePowerups, "weight")) {
                            game.player.vy += playerGrav * 5 / 2 * 25;
                        } else {
                            game.player.vy += playerGrav * 25;
                        }
                    }
                    game.player.ducking = false;
                    for (i = 0; i < game.fbs.length; i += 1) {
                        if (game.player.ducking === false && Collision.playerHeadNearFb(game.player, game.fbs[i])) {
                            game.player.ducking = true;
                        }
                        if (Collision.player_fb(game.player, game.fbs[i])) {
                            die(game);
                        }
                    }
                    game.coins.forEach(function (coin, index) {
                        if (Collision.player_coin(game.player, coin)) {
                            game.coins.splice(index, 1);
                            game.points += handleActivesPoints(game.activePowerups, coinValue * difficultyCurveFromPoints(game.points));
                        }
                    });
                    game.powerups.forEach(function (powerup, key) {
                        if (Collision.player_powerup(game.player, powerup)) {
                            game.powerups[key] = null;
                            addToActivePowerups(game, powerup.type, powerup.xPos(), powerup.yPos());
                        }
                    });
                    game.player.x = modulo(game.player.x + game.player.vx * dt / 20, gameWidth);
                    game.player.y += game.player.vy * dt / 20;
                    game.player.wheelAngle += signNum(game.player.vx) * 0.2 * dt;
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
                    game.coinGridOffset = game.coinGridOffset % 35;
                    game.coins.forEach(function (coin, index) {
                        coin.y -= dy;
                        var distance;
                        if (magnetOn) {
                            distance = coin.distanceTo(game.player);
                            if (distance < 100 && distance !== 0) {
                                coin.setDistanceTo(game.player, distance - (100 / distance));
                            }
                        }
                        if (coin.y < -2 * coinRadius) {
                            game.coins.splice(index, 1);
                        }
                    });
                    var chanceFactor = 10 / 7;
                    if (Math.random() < 1 / (1000 * 25) * dt) {
                        addDiagCoinPattern(game, Math.random() < 0.5);
                    } else {
                        if (Math.random() < 1 / 1000 * chanceFactor * dt) {
                            var column = Math.floor(Math.random() * 8);
                            var pos = (column + 0.5) * 35;
                            var newcoin = createCoin(pos, coinStartingY + 35 - game.coinGridOffset);
                            game.coinColumnsLowest[column] = game.coinColumnsLowest[column] || newcoin;
                            if (newcoin.y - game.coinColumnsLowest[column].y <= 35) {
                                newcoin.y += 35;
                                game.coinColumnsLowest[column] = newcoin;
                            }
                            game.coins.push(newcoin);
                        }
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
                    if (!game.powerups.X2 && Math.random() < 1 / 75000 * dt) { // 100 times less frequent than fireballs
                        game.powerups.X2 = makePowerupRandom("X2", 25, 145);
                    }
                    if (!game.powerups.slow && Math.random() < 1 / 75000 * dt) {
                        game.powerups.slow = makePowerupRandom("slow", 25, 145);
                    }
                    if (!game.powerups.weight && game.points > 50 && Math.random() < 1 / 75000 * dt) {
                        game.powerups.weight = makePowerupRandom("weight", 25, 145);
                    }
                    if (!game.powerups.magnet && Math.random() < 1 / 75000 * dt) {
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
            handleTouchend: function (game, touch) {
                if (!game.paused && !game.dead) {
                    maybeGetPlatfmFromTouch(touch, function (platfm) {
                        game.platfms.push(platfm);
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
                        Render.btnLayer(game);
                    }
                } else if (game.dead) {
                    if (replayBtn.touchIsInside(p)) {
                        restart();
                    }
                } else if (!disallowPause && pauseBtn.touchIsInside(p)) {
                    game.paused = true;
                    Render.btnLayer(game);
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
                        Render.btnLayer(game);
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
                    // The interval isn't cleared because the same interval
                    // is used for the next game (after the restart).
                    game = createGame();
                    setCurGame(game);
                    Render.btnLayer(game);
                },
                prevFrameTime = Date.now();
            setCurGame(game);
            setInterval(function () {
                window.game = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.

                // Initialize time deltas
                var now = Date.now(),
                    realDt = now - prevFrameTime,
                    dt;
                // Cap realDt at 3 times the normal frame length to prevent
                // a large noticable jump in on-screen objects:
                realDt = Math.min(realDt, 1000 / fps * 3);

                realDt *= difficultyCurveFromPoints(game.points);

                // Handle effects of slow powerup
                if (powerupObtained(game.activePowerups, "slow")) {
                    dt = realDt * 2/3;
                    // Any functions given 'dt' as the time delta will thus
                    // behave as if 2/3 as much time has passed.
                } else {
                    dt = realDt;
                }
                prevFrameTime = now;

                if (game.paused) {
                    Render.gamePaused(game);
                } else if (game.dead) {
                    Render.gameDead(game);
                } else {
                    // Update state
                    gUpdaters.player(game, dt);
                    gUpdaters.coins(game, dt);
                    gUpdaters.fbs(game, dt);
                    gUpdaters.platfms(game, dt);
                    gUpdaters.powerups(game, dt);
                    gUpdaters.activePowerups(game, dt);
                    game.points += handleActivesPoints(game.activePowerups, timeBasedPointsVanilla(game.player.y, realDt));
                    // Because timeBasedPoints takes 'realDt', when the slow
                    // powerup is held, points still flow in at the normal
                    // speed from the user's perspective.

                    if (game.dead) {
                        highscores.sendScore(Math.floor(game.points));
                    }

                    // Render
                    if (!game.dead && !game.paused) {
                        game.previewPlatfmTouch = Touch.curTouch;
                    }
                    Render.game(game);
                }
            }, 1000 / fps);
            Touch.onTouchend = function (touch) {
                gEventHandlers.handleTouchend(game, touch);
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
                prevFrameTime = Date.now(),
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
                    clearInterval(intervalId);
                    document.body.onclick = function () {};
                    play(game);
                },
                restartTut = function () {
                    game = createGame();
                    curAutomatedTouch = createAutomatedTouch(autoTouchDir);
                },
                intervalId;
            var prevX, prevY, midwayX, midwayY;
            intervalId = setInterval(function () {
                window.tutorial = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.

                // Initialize time deltas
                var now = Date.now(),
                    dt = now - prevFrameTime;
                // Cap dt at 3 times the normal frame length to prevent
                // a large noticable jump in on-screen objects:
                dt = Math.min(dt, 1000 / fps * 3);

                dt *= difficultyCurveFromPoints(game.points);

                prevFrameTime = now;

                if (game.paused) {
                    Render.gamePaused(game);
                } else if (game.dead) {
                    Render.gameDead(game);
                } else {
                    // Update state
                    gUpdaters.player(game, dt);
                    gUpdaters.platfms(game, dt);
                    if (Touch.curTouch) {
                        materializeAutoTouch();
                        startRealGame();
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
            }, 1000 / fps);
            Touch.onTouchend = function (touch) {
                gEventHandlers.handleTouchend(game, touch);
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
                intervalId,
                prevTime = Date.now();
            window.menu = menu;
            intervalId = setInterval(function () {
                var now = Date.now(), dt = now - prevTime;
                prevTime = now;
                updateFbsGeneric(menu, dt);
                Render.menu(menu);
            }, 1000 / fps);
            document.body.onclick = function (event) {
                var pos = calcTouchPos(event), tpos = {x1: pos.x, y1: pos.y};
                if (menuPlayBtn.touchIsInside(tpos)) {
                    clearInterval(intervalId);
                    document.body.onclick = function () {};
                    runTutorial();
                }
            };
        };
    runMenu();
}());