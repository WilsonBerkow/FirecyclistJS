// (c) Wilson Berkow
// Firecyclist.js

if (typeof Math.log2 !== "function") {
    Math.log2 = function (e) {
        "use strict";
        return Math.log(e) / Math.log(2);
    };
}

(function () {
    "use strict";
    // Screen-resizing code:
    // These manual-set titles are not related to the game, they are here
    // so I can fuck around with my friend without committing private
    // information.
    var htmlModule = document.getElementById("Main"),
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
            return {
                "x": (typeof event.clientX === "number" ? event.clientX : event.originalEvent.changedTouches[0].clientX) / pageScaleFactor - moduleOffsetX,
                "y": (typeof event.clientY === "number" ? event.clientY : event.originalEvent.changedTouches[0].clientY) / pageScaleFactor
            };
        },
        handleTouchend,
        curTouch = null,
        mkHighscores = function (identifier, handleUnlockingStuff) {
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
    resize();
    (function () { // Simple Touch system, similar to Elm's but compatible with the Platfm interface
        var touchesCount = 0;
        jQuery(document).on("mousemove touchmove", function (event) {
            var xy = calcTouchPos(event);
            if (curTouch !== null) { // Condition fails when a platfm has been materialized, and thus curTouch was reset to null
                curTouch.x1 = xy.x;
                curTouch.y1 = xy.y;
            }
            event.preventDefault(); // Stops the swipe-to-move-through-browser-history feature in Chrome from interferring.
        });
        jQuery(document).on("mousedown touchstart", function (event) {
            var now = Date.now(), xy = calcTouchPos(event);
            curTouch = {
                "t0": now,
                "id": touchesCount,
                "x0": xy.x,
                "y0": xy.y,
                "x1":  xy.x,
                "y1":  xy.y
            };
            touchesCount += 1;
        });
        jQuery(document).on("mouseup touchend", function () {
            if (typeof handleTouchend === "function" && curTouch) {
                handleTouchend(curTouch);
            }
            curTouch = null;
            // Do not use preventDefault here, it prevents
            // triggering of the 'tap' event.
        });
    }());
    var // UTIL:
        makeObject = function (proto, props) {
            var o = Object.create(proto);
            Object.keys(props).forEach(function (key) {
                o[key] = props[key];
            });
            return o;
        },
        avg = (function () {
            var sum2 = function (a, b) { return a + b; },
                sum = function (arr) {
                    return arr.reduce(sum2);
                };
            return function () {
                var nums = [].slice.apply(arguments);
                return sum(nums) / nums.length;
            };
        }()),
        modulo = function (num, modBy) {
            return num > modBy ? modulo(num - modBy, modBy) :
                   num < 0 ? modulo(num + modBy, modBy) :
                   num;
        },
        pythag = function (a, b) { return Math.sqrt(a*a + b*b); },
        dist = function (x0, y0, x1, y1) { return pythag(x1 - x0, y1 - y0); },
        sqrt2 = Math.sqrt(2),
        sqrt3 = Math.sqrt(3),
        // CONFIG:
        canvasBackground = "rgb(185, 185, 255)", // Used in CSS
        framerate = 40,
        canvasWidth = 576 / 2,
        canvasHeight = 1024 / 2,
        playerGrav = 0.32 / 28,
        fbFallRate = 2 / 20,
        fbRadius = 10,
        coinFallRate = 2 / 20,
        coinRadius = 10,
        coinSquareLen = 8.5,
        coinValue = 11,
        platfmFallRate = 3 / 20,
        totalFbHeight = 10,
        platfmBounciness = 0.75,
        platfmThickness = 6,
        playerTorsoLen = 15 * 5/8,
        playerRadius = 10 * 6/8,
        playerHeadRadius = 9 * 5/8,
        playerElbowXDiff = 8 * 5/8,
        playerElbowYDiff = 2 * 5/8,
        powerupTotalLifespan = 5500, // in milliseconds
        pauseBtnCenterX = 10,
        pauseBtnCenterY = -5,
        pauseBtnRadius = 65,
        restartBtnCenterX = canvasWidth - 10,
        restartBtnCenterY = -5,
        restartBtnRadius = 65,
        inGamePointsPxSize = 30,
        inGamePointsYPos = 30,
        menuPlayBtnX = canvasWidth / 2,
        menuPlayBtnY = 280,
        menuPlayBtnW = 121,
        menuPlayBtnH = 44,
        menuScrollingBtnY = 280,
        menuLoopBtnY = 340,
        powerupX2Width = 36,
        powerupX2Height = 30,
        powerupSlowRadius = 10,
        powerupWeightScaleUnit = 0.8,
        powerupWeightUpperWidth = 30 * powerupWeightScaleUnit,
        powerupWeightLowerWidth = 40 * powerupWeightScaleUnit,
        powerupWeightHeight = 24 * powerupWeightScaleUnit,
        activePowerupLifespan = 10000,
        // More util:
        isOverPauseBtn = function (xy) {
            return dist(xy.x1, xy.y1, pauseBtnCenterX, pauseBtnCenterY) < pauseBtnRadius;
        },
        isOverRestartBtn = function (xy) {
            return dist(xy.x1, xy.y1, restartBtnCenterX, restartBtnCenterY) < restartBtnRadius;
        },
        isOverPlayBtn = function (xy) {
            return xy.y1 >= menuPlayBtnY - 5 && xy.y1 <= menuPlayBtnY + menuPlayBtnH + 5;
        },
        objIsVisible = function (hradius, obj) {
            return obj.x > -hradius && obj.x < canvasWidth + hradius;
        },
        playerYToStdHeadCenterY = function (y) { // 'Std' because it assumes player is not ducking.
            return y - playerTorsoLen - playerRadius - playerHeadRadius;
        };
    // RENDER:
    var renderers = (function () {
        var mainCtx = document.getElementById("canvas").getContext("2d"),
            btnCtx = document.getElementById("btnCanvas").getContext("2d"),
            overlayCtx = document.getElementById("overlayCanvas").getContext("2d"), // TODO: screw all these wrapper functions, and make each context be declared and used like this one.
            drawer = (function () {
                return function (draw) { // Opens a "drawing session"
                    return function () {
                        mainCtx.save();
                        draw.apply(null, [mainCtx].concat([].slice.apply(arguments)));
                        mainCtx.restore();
                    };
                };
            }()),
            fillShadowyText = function (ctx, text, x, y, reverse, offsetAmt, w, h) { // Intentionally doesn't open up a new drawing session, so that other styles can be set beforehand.
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
            wheelAt = (function () {
                var sines = [],   // Sine and cosine tables are used so that the approximation work doesn't
                    cosines = [], // have to be done more than once for any given angle. The angles of the
                                  // spokes are rounded down to the nearest degree.
                                  // TODO: Extract these tables and use them for as many other uses of
                                  //  Math.sin and Math.cos as possible.
                    oneDegree = Math.PI / 180,
                    i,
                    getSin = function (radians) {
                        return sines[modulo(Math.floor(radians / oneDegree), 360)];
                    },
                    getCos = function (radians) {
                        return cosines[modulo(Math.floor(radians / oneDegree), 360)];
                    };
                for (i = 0; i < 360; i += 1) {
                    sines[i] = Math.sin(i * oneDegree);
                    cosines[i] = Math.cos(i * oneDegree);
                }
                return function (ctx, x, y, angle) {
                    circleAt(ctx, x, y, playerRadius);
                    var spokeAngle = 0, spinOffset = angle * oneDegree, relX, relY, i;
                    for (i = 0; i < 6; i += 1) {
                        relX = getCos(spinOffset + spokeAngle) * playerRadius;
                        relY = getSin(spinOffset + spokeAngle) * playerRadius;
                        ctx.moveTo(x + relX, y + relY);
                        ctx.lineTo(x - relX, y - relY);
                        if (i !== 5) {
                            spokeAngle += 1/3 * Math.PI;
                        }
                    }
                };
            }()),
            drawPlayerDuckingAt = function (ctx, x, y, wheelAngle) {
                ctx.beginPath();
                
                var playerHeadX = x - 3;
                var playerHeadY = y - 10;
                
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
                
                wheelAt(ctx, x, y, wheelAngle);
                
                ctx.stroke();
                
                // Solid body of head, with slight extra radius for outline:
                var style = ctx.fillStyle;
                ctx.beginPath();
                ctx.fillStyle = canvasBackground;
                circleAt(ctx, playerHeadX, playerHeadY, playerHeadRadius + ctx.lineWidth / 2);
                ctx.fill();
                ctx.fillStyle = style;
                
                //
                // Now for the lines to appear on top of the head:
                
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
                ctx.beginPath();
                circleAt(ctx, x, playerYToStdHeadCenterY(y), playerHeadRadius);
                ctx.moveTo(x, y - playerTorsoLen - playerRadius);
                ctx.lineTo(x, y); // (x, y) is the center of the wheel
                
                wheelAt(ctx, x, y, wheelAngle);
                
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
            drawCoin = function (ctx, coin) {
                if (!objIsVisible(2 * coinRadius, coin)) { return; }
                ctx.lineWidth = 2;
                circle(ctx, coin.x, coin.y, coinRadius, "yellow", "fill");
                circle(ctx, coin.x, coin.y, coinRadius, "orange", "stroke");
                ctx.fillStyle = "darkOrange";
                ctx.fillRect(coin.x - coinSquareLen / 2, coin.y - coinSquareLen / 2, coinSquareLen, coinSquareLen);
                ctx.strokeStyle = "orange";
                ctx.strokeRect(coin.x - coinSquareLen / 2, coin.y - coinSquareLen / 2, coinSquareLen, coinSquareLen);
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
            pxSize = 36,
            drawTLBtnOutline = function (ctx, game) {
                var colory = !game.dead && (game.paused || (curTouch && isOverPauseBtn(curTouch)));
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)";
                ctx.arc(pauseBtnCenterX, pauseBtnCenterY, pauseBtnRadius, 0, 2 * Math.PI, true);
                ctx.fill();
                return colory;
            },
            drawPauseBtn = function (ctx, game) {
                var colory = drawTLBtnOutline(ctx, game);
                ctx.font = "bold " + pxSize + "px arial";
                ctx.textAlign = "left";
                fillShadowyText(ctx, "II", 15, 15 + pxSize / 2, colory);
            },
            drawBackBtn = function (ctx, game) {
                var colory = drawTLBtnOutline(ctx, game);
                ctx.font = "bold " + 1.5 * pxSize + "px arial";
                ctx.textAlign = "left";
                fillShadowyText(ctx, "↩", 5, (15 + pxSize / 2) * 1.2, colory);
            },
            offCanvImg = function (w, h, src) {
                var offCanvas = document.createElement('canvas'),
                    offCtx,
                    img = document.getElementById(src);
                offCanvas.width = w;
                offCanvas.height = h;
                offCtx = offCanvas.getContext('2d');
                offCtx.drawImage(img, 0, 0, w, h);
                return offCanvas;
            },
            drawRestartBtn = (function () {
                var offCanvasBlack = offCanvImg(pxSize, pxSize, "restart-arrow-black"),
                    offCanvasOrange = offCanvImg(pxSize, pxSize, "restart-arrow-orange");
                return function (ctx, game) {
                    var colory = !game.dead && !game.paused && curTouch && isOverRestartBtn(curTouch);
                    ctx.beginPath();
                    ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)";
                    ctx.arc(restartBtnCenterX, restartBtnCenterY, restartBtnRadius, 0, 2 * Math.PI, true);
                    ctx.fill();
                    if (colory) {
                        ctx.drawImage(offCanvasOrange, canvasWidth - 25 - pxSize / 2, -13 + pxSize / 2, pxSize, pxSize);
                    } else {
                        ctx.drawImage(offCanvasBlack, canvasWidth - 25 - pxSize / 2, -13 + pxSize / 2, pxSize, pxSize);
                    }
                };
            }()),
            clearBtnLayer = function () {
                btnCtx.clearRect(0, 0, canvasWidth, 100);
            },
            redrawBtnLayer = function (game) {
                clearBtnLayer();
                if (!game.paused && !game.dead) {
                    drawPauseBtn(btnCtx, game);
                    drawRestartBtn(btnCtx, game);
                }
            },
            drawInGamePoints = function (ctx, game) {
                if (!game.dead) {
                    ctx.textAlign = "center";
                    ctx.font = "bold " + inGamePointsPxSize + "px r0";
                    fillShadowyText(ctx, Math.floor(game.points), canvasWidth / 2, inGamePointsYPos);
                }
            },
            drawPowerup = function (ctx, type, x, y) {
                var unit = powerupWeightScaleUnit;
                if (type === "X2") {
                    ctx.fillStyle = "gold";
                    ctx.textAlign = "left";
                    ctx.font = "bold italic 22px arial";
                    ctx.lineWidth = 1;
                    ctx.fillText("X2", x - powerupX2Width / 2 + 5, y + powerupX2Height / 4, powerupX2Width, powerupX2Height);
                    ctx.strokeStyle = "orange";
                    ctx.strokeText("X2", x - powerupX2Width / 2 + 5, y + powerupX2Height / 4, powerupX2Width, powerupX2Height);
                } else if (type === "slow") {
                    ctx.globalAlpha = 0.7;
                    circle(ctx, x, y, powerupSlowRadius, "silver", "fill");
                    ctx.globalAlpha = 1;
                    ctx.lineWidth = 3;
                    circle(ctx, x, y, powerupSlowRadius, "gray", "stroke");
                    ctx.beginPath();
                    lineFromTo(ctx, x, y, x, y - powerupSlowRadius * 0.75);
                    lineFromTo(ctx, x, y, x + powerupSlowRadius * 0.75, y);
                    ctx.stroke();
                } else if (type === "weight") {
                    ctx.beginPath();
                    ctx.moveTo(x - powerupWeightUpperWidth / 2, y - powerupWeightHeight / 2);
                    ctx.lineTo(x + powerupWeightUpperWidth / 2, y - powerupWeightHeight / 2);
                    ctx.lineTo(x + powerupWeightLowerWidth / 2, y + powerupWeightHeight / 2);
                    ctx.lineTo(x - powerupWeightLowerWidth / 2, y + powerupWeightHeight / 2);
                    ctx.fillStyle = "black";
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.moveTo(x - 10 * unit, y - powerupWeightHeight / 2);
                    ctx.lineTo(x - 6 * unit, y - powerupWeightHeight / 2 - 4 * unit);
                    ctx.lineTo(x + 6 * unit, y - powerupWeightHeight / 2 - 4 * unit);
                    ctx.lineTo(x + 10 * unit, y - powerupWeightHeight / 2);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "black";
                    ctx.stroke();
                    
                    ctx.font = "bold 28px Courier New";
                    ctx.fillStyle = "lightGrey";
                    ctx.textAlign = "center";
                    ctx.fillText("1000", x, y + 11 * unit, 30 * unit);
                } else if (type === "magnet") {
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
                }
            },
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
                ctx.arc(x, y, 18, 0, angleOfGrayArc, false);
                ctx.fillStyle = nearDeath ? "rgba(200, 0, 0, 1)" : "rgba(150, 150, 150, 0.65)";
                ctx.fill();
                if (angleOfGrayArc < 2 * Math.PI) { // To prevent the entire circle from being filled when really none should be filled. This condition can happen due to rounding in 'roundedFrac'.
                    // Fill in the rest of the circle with a ghosted gray;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.arc(x, y, 18, 0, angleOfGrayArc, true);
                    ctx.fillStyle = "rgba(150, 150, 150, 0.25)";
                    ctx.fill();
                }
            },
            drawActivePowerups = function (ctx, actives) {
                var xPos = canvasWidth / 2 + inGamePointsPxSize, yPos = inGamePointsYPos, i;
                for (i = actives.length - 1; i >= 0; i -= 1) { // Start with the last activepowerups, which have been around the longest.
                    drawActivePowerupBackground(ctx, actives[i].lifetime, actives[i].totalLifetime, xPos, yPos);
                    drawPowerup(ctx, actives[i].type, xPos, yPos);
                    xPos += actives[i].width;
                }
            },
            drawMenuTitle = drawer(function (ctx) {
                ctx.font = "italic bold 170px arial";
                ctx.textAlign = "center";
                fillShadowyText(ctx, "Fire", canvasWidth / 2 - 3, 190, true, 3);
                ctx.font = "italic bold 95px arial";
                fillShadowyText(ctx, "cyclist", canvasWidth / 2 - 3, 240, true, 2);
            }),
            drawButtonBandAt = function (ctx, y) {
                ctx.fillStyle = "rgba(170, 170, 170, 0.5)";
                ctx.fillRect(0, y - 5, canvasWidth, 54 + 12);
            },
            // TODO: FACTOR COMMONALITIES OF BUTTONS
            drawMenuPlayBtn = drawer(function (ctx) {
                if (curTouch && isOverPlayBtn(curTouch)) {
                    drawButtonBandAt(ctx, menuPlayBtnY);
                }
                ctx.font = "italic bold 54px i0";
                ctx.textAlign = "center";
                ctx.fillStyle = "rgb(150, 140, 130)";
                ctx.fillText("Play", menuPlayBtnX, menuPlayBtnY + menuPlayBtnH, menuPlayBtnW, menuPlayBtnH);
            }),
            drawMenuPlayScrollBtn = drawer(function (ctx) {
                if (curTouch && isOverScrollBtn(curTouch)) {
                    drawButtonBandAt(ctx, menuScrollingBtnY);
                }
                ctx.font = "italic bold 54px corbel";
                ctx.textAlign = "center";
                ctx.fillStyle = "rgb(150, 140, 130)";
                ctx.fillText("Free", menuPlayBtnX, menuScrollingBtnY + menuPlayBtnH, menuPlayBtnW, menuPlayBtnH);
            }),
            drawMenuPlayLoopBtn = drawer(function (ctx) {
                if (curTouch && isOverLoopBtn(curTouch)) {
                    drawButtonBandAt(ctx, menuLoopBtnY);
                }
                ctx.font = "italic bold 54px corbel";
                ctx.textAlign = "center";
                ctx.fillStyle = "rgb(150, 140, 130)";
                ctx.fillText("Confined", menuPlayBtnX, menuLoopBtnY + menuPlayBtnH, menuPlayBtnW * 1.4, menuPlayBtnH);
            }),
            drawMenu = drawer(function (ctx, menu) {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                drawFbs(ctx, menu.fbs);
                drawFirebits(ctx, menu.firebitsRed, "red");
                drawFirebits(ctx, menu.firebitsOrg, "darkOrange");
                drawMenuTitle();
                drawMenuPlayBtn();
            }),
            drawGame = drawer(function (ctx, game) {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                overlayCtx.clearRect(0, 0, canvasWidth, canvasHeight);
                if (game.player.ducking) {
                    drawPlayerDuckingAt(ctx, game.player.x, game.player.y, game.player.wheelAngle);
                } else {
                    drawPlayerAt(ctx, game.player.x, game.player.y, game.player.wheelAngle);
                    
                }
                setupGenericPlatfmChars(ctx);
                game.platfms.forEach(function (platfm) {
                    drawPlatfm(ctx, platfm);
                });
                ctx.globalAlpha = 1; // Changed in platfm drawing, so must be reset
                if (game.previewPlatfmTouch) {
                    drawPreviewPlatfm(ctx, game.previewPlatfmTouch);
                }
                drawFbs(ctx, game.fbs);
                drawFirebits(ctx, game.firebitsRed, "red");
                drawFirebits(ctx, game.firebitsOrg, "darkOrange");
                game.coins.forEach(function (coin) {
                    drawCoin(ctx, coin);
                });
                game.powerups.forEach(function (powerup) {
                    drawPowerup(ctx, powerup.type, powerup.xPos(), powerup.yPos());
                });
                drawActivePowerups(ctx, game.activePowerups);
                drawInGamePoints(ctx, game);
            }),
            gameOverlayDrawer = (function () { // Specialized version of 'drawer' for drawing game overlays like the Paused or GameOver screens.
                var vagueify = function (ctx) {
                        ctx.fillStyle = "rgba(200, 200, 200, 0.75)";
                        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                    };
                return function (f) {
                    return drawer(function (ctx, game) {
                        var args = [].slice.apply(arguments).slice(1);
                        drawGame(game);
                        vagueify(overlayCtx);
                        f.apply(null, [overlayCtx].concat(args)); // 'args' includes 'game'
                    });
                };
            }()),
            drawGamePaused = gameOverlayDrawer(function (ctx, game) {
                ctx.fillStyle = "darkOrange";
                ctx.font = "54px r0";
                ctx.textAlign = "center";
                ctx.fillText("Paused", canvasWidth / 2, canvasHeight / 2 - 12);
            }),
            drawGameDead = gameOverlayDrawer(function (ctx, game) {
                var startY = 105;
                
                // 'Game Over' text
                ctx.fillStyle = "darkOrange";
                ctx.font = "bold italic 90px i0";
                ctx.textAlign = "center";
                ctx.fillText("Game", canvasWidth / 2 - 4, startY);
                ctx.fillText("Over", canvasWidth / 2 - 4, startY + 75);
                
                // Points big
                ctx.font = "140px r0";
                ctx.fillText(Math.floor(game.points), canvasWidth / 2, canvasHeight * 2 / 3 - 28);
                
                // Line separator
                ctx.beginPath();
                ctx.strokeStyle = "darkOrange";
                ctx.moveTo(30, startY + 260);
                ctx.lineTo(canvasWidth - 30, startY + 260);
                ctx.moveTo(30, startY + 262);
                ctx.lineTo(canvasWidth - 30, startY + 262);
                ctx.stroke();
                
                // Highscores
                ctx.font = "bold italic 28px i0";
                ctx.fillText("Highscores", canvasWidth / 2, startY + 300);
                var scoreFontSize = 24;
                ctx.font = scoreFontSize + "px r0";
                var curY = startY + 325;
                highscores.highest().forEach(function (score) {
                    if (!score) { return; }
                    ctx.fillText(score, canvasWidth / 2, curY);
                    curY += scoreFontSize + 2;
                });
            });
        return [drawGame, drawGamePaused, drawGameDead, drawMenu, redrawBtnLayer, clearBtnLayer];
    }());
    var drawGame = renderers[0], drawGamePaused = renderers[1], drawGameDead = renderers[2], drawMenu = renderers[3], redrawBtnLayer = renderers[4], clearBtnLayer = renderers[5];
    
    // Handle device events:
    var setCurGame = (function () {
        var curGame = null;
        document.addEventListener("pause", function () {
            localStorage.setItem("halted_game", JSON.stringify(curGame));
        }, false);
        document.addEventListener("resume", function () {
            var storedGameText = localStorage.getItem("halted_game");
            if (typeof storedGameText === "string") {
                var storedGame = JSON.parse(storedGameText);
                storedGame.paused = true;
                start.play(storedGame);
            }
        }, false);
        return function (game) {
            curGame = game;
        };
    }());
    
    // PLAY:
    var start = (function () {
        var // MODEL + CALC:
            anglify = function (doCalc, f) {
                var proto = {
                    angle: function () {
                        return doCalc ? Math.atan2(this.y1 - this.y0, this.x1 - this.x0)
                                      : Math.atan2(this.vy, this.vx);
                    },
                    magnitude: function () {
                        return doCalc ? dist(this.x0, this.y0, this.x1, this.y1)
                                      : pythag(this.vx, this.vy);
                    },
                    slope: function () {
                        return doCalc ? (this.y1 - this.y0) / (this.x1 - this.x0)
                                      : this.vy / this.vx;
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
            createVel = anglify(false, function (vx, vy) {
                return {"vx": vx, "vy": vy};
            }),
            withAngularCtrls = (function () {
                var proto = {
                        "angleTo": function (xy) { // Currently unused, but as definition adds only constant time and may be useful in future, I'll leave it.
                            return Math.atan2(xy.y - this.y, xy.x - this.x);
                        },
                        "distanceTo": function (xy) {
                            return dist(this.x, this.y, xy.x, xy.y);
                        },
                        "setDistanceTo": function (xy, newd) {
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
            }()),
            createPlayer = anglify(false, function (x, y, vx, vy) {
                return {"x": x, "y": y, "vx": vx, "vy": vy, "wheelAngle": 0, "ducking": false};
            }),
            createPlatfm = anglify(true, function (x0, y0, x1, y1) {
                return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "time_left": 800};
            }),
            copyTouch = function (t) {
                return {
                    "t0": t.t0,
                    "id": t.id,
                    "x0": t.x0,
                    "y0": t.y0,
                    "x1": t.x1,
                    "y1": t.y1
                };
            },
            touchIsNaNMaker = function (touch) { // Returns whether or not `touch` will cause NaN to appear.
                return touch.x0 === touch.x1 && touch.y0 === touch.y1;
            },
            createCoin = withAngularCtrls(function (x, y) {
                return {"x": x, "y": y};
            }),
            createFb = function (x, y) {
                return {"x": x, "y": y};
            },
            createFirebit = function (x, y) {
                return {"x": x, "y": y, "lifespan": 0};
            },
            createPowerup = (function () {
                var proto = {
                    xDistanceTravelled: function () {
                        return this.lifetime / powerupTotalLifespan * canvasWidth;
                    },
                    xPos: function () {
                        return this.xDistanceTravelled();
                    },
                    yPos: function () {
                        return this.offsetY + Math.sin(this.xDistanceTravelled() / 20) * 40;
                    }
                };
                return function (y, powerupType) {
                    return makeObject(proto, {"offsetY": y, "lifetime": 0, "type": powerupType});
                };
            }()),
            createActivePowerup = function (type) {
                var lifetime = type === "slow" ? activePowerupLifespan / 2 : activePowerupLifespan;
                return {
                    "type": type,
                    "width": type === "X2"     ? powerupX2Width :
                             type === "slow"   ? powerupSlowRadius * 2 :
                             type === "weight" ? 40 :
                             type === "magnet" ? powerupSlowRadius * 2 + 15 :
                             40,
                    "totalLifetime": lifetime,
                    "lifetime": lifetime
                }; // TODO: INCLUDE srcX, srcY, timeSinceAcquired FOR ANIMATIONS
            },
            simpleIterable = function (propsToIter) {
                var proto = {
                    "forEach": function (f) {
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
            createGame = (function () {
                var mkPowerupsObj = simpleIterable(["X2", "slow", "weight", "magnet"]);
                return function () {
                    return {
                        "player": createPlayer(canvasWidth / 2, 50, 0, 0),
                        "platfms": [],
                        "previewPlatfmTouch": null,
                        "fbs": [],
                        "firebitsRed": [],
                        "firebitsOrg": [],
                        "coins": [],
                        "powerups": mkPowerupsObj({}),
                        "activePowerups": [],
                        "points": 0,
                        "paused": false,
                        "dead": false
                    };
                };
            }()),
            signNum = function (num) {
                return num > 0 ? 1 :
                       num < 0 ? -1 :
                       0;
            },
            velFromPlatfm = function (dt, player, platfm) {
                var slope = platfm.slope(),
                    cartesianVel = createVel(signNum(slope) * 3, Math.abs(slope) * 3 - platfmFallRate * dt - platfmBounciness);
                cartesianVel.setMagnitude(Math.min(cartesianVel.magnitude(), player.magnitude()) + playerGrav * dt);
                return {
                    "x": cartesianVel.vx,
                    "y": cartesianVel.vy
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
            playerWheelHittingCircle = function (player, x, y, circleRadius) {
                return dist(player.x, player.y, x, y) < playerRadius + circleRadius;
            },
            playerHittingCircle = function (player, x, y, circleRadius) {
                return playerWheelHittingCircle(player, x, y, circleRadius)
                    || (!player.ducking && dist(player.x, playerYToStdHeadCenterY(player.y), x, y) < playerHeadRadius + circleRadius);
            },
            circleHittingRect = function (circX, circY, radius, rectX, rectY, rectWidth, rectHeight) { // Adapted from StackOverflow answer by 'e. James': http://stackoverflow.com/a/402010
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
            playerHittingRect = function (player, x, y, w, h) {
                var headY = playerYToStdHeadCenterY(player.y);
                return circleHittingRect(player.x, player.y, playerRadius, x, y, w, h) ||
                       (!player.ducking && circleHittingRect(player.x, headY, playerHeadRadius, x, y, w, h));
            },
            playerHeadNearFb = function (player, fb) {
                var headWithMargin = playerHeadRadius + 10;
                // Add a margin of 10 so he ducks a little early.
                return dist(player.x, playerYToStdHeadCenterY(player.y), fb.x, fb.y) < headWithMargin + fbRadius;
            },
            playerHittingFb = function (player, fb) {
                return playerWheelHittingCircle(player, fb.x, fb.y, fbRadius);
            },
            playerHittingCoin = function (player, coin) {
                return playerHittingCircle(player, coin.x, coin.y, coinRadius);
            },
            playerHittingPowerup = function (player, powerup) {
                if (powerup.type === "X2") {
                    return playerHittingRect(player, powerup.xPos(), powerup.yPos(), powerupX2Width, powerupX2Height);
                }
                if (powerup.type === "slow") {
                    return playerHittingCircle(player, powerup.xPos(), powerup.yPos(), powerupSlowRadius);
                }
                if (powerup.type === "weight") {
                    return playerHittingRect(player, powerup.xPos(), powerup.yPos(), powerupWeightLowerWidth, powerupWeightHeight);
                }
                if (powerup.type === "magnet") {
                    return playerHittingCircle(player, powerup.xPos(), powerup.yPos(), powerupSlowRadius);
                }
            },
            randomXPosition = function () {
                return Math.random() * canvasWidth;
            },
            // firebits: the little slivers that fall around a fireball
            makeFirebitAround = function (fbX, fbY) {
                var relX = Math.random() * 2 * fbRadius - fbRadius,
                    absoluteX = fbX + relX,
                    maxRelY = -Math.sqrt(fbRadius * fbRadius - relX * relX),
                    absoluteY = fbY + Math.random() * maxRelY - 3;
                return createFirebit(absoluteX, absoluteY);
            },
            // 'fb' is short for 'fireball'
            updateFbsGeneric = function (obj, dt) { // This is used in both play and runMenu, and thus must be declared here.
                var fbArray = Array.isArray(obj) ? obj : obj.fbs,
                    fewInLowerPortion = function () { // If too few FBs are in the lower portion of the screen, more must be made
                        var i, fb;
                        for (i = 0; i < fbArray.length; i += 1) {
                            fb = fbArray[i];
                            if (fb.y > canvasHeight * 3 / 4) {
                                return false;
                            }
                        }
                        return true;
                    },
                    fbFirebitsRed = Array.isArray(obj) ? null : obj.firebitsRed,
                    fbFirebitsOrg = Array.isArray(obj) ? null : obj.firebitsOrg,
                    firebitBeyondVisibility = function (firebit) { // So that when one moves left, to make a fb on the right side go offscreen, and then quickly goes back, the user doesn't notice that the firebits are temporarily depleted.
                        return firebit.x > -fbRadius * 4 && firebit.x < canvasWidth + fbRadius * 4;
                    },
                    x, y,
                    updateFirebits = function (firebits) {
                        firebits.forEach(function (firebit, index) {
                            if (!firebitBeyondVisibility(firebit)) {
                                firebits.splice(index, 1);
                            }
                            firebit.y += Math.random() * 1.5 + 0.1;
                            firebit.x += Math.random() * 1.5 - 1;
                            firebit.lifespan += dt;
                            if (firebit.lifespan >= 100 && Math.random() < 0.3) {
                                firebits.splice(index, 1);
                            }
                        });
                    };
                // fbArray can't be abstracted out and used in closure, because
                // every new game uses a different 'fbs' array and 'game' object
                fbArray.forEach(function (fb, index) {
                    fb.y -= fbFallRate * dt;
                    if (fb.y < -totalFbHeight) {
                        fbArray.splice(index, 1);
                    }
                    if (!objIsVisible(2 * fbRadius, fb)) { return; } // The '2 *' is so that when the user moves left/right, edge-fbs will already have firebits around them
                    if (fbFirebitsRed) {
                        fbFirebitsRed.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsRed.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsRed.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsRed.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsRed.push(makeFirebitAround(fb.x, fb.y));
                        //fbFirebitsRed.push(makeFirebitAround(fb.x, fb.y));
                        //fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                        fbFirebitsOrg.push(makeFirebitAround(fb.x, fb.y));
                    }
                });
                updateFirebits(fbFirebitsRed);
                updateFirebits(fbFirebitsOrg);
                var chanceFactor = (1 / 7);
                if (Math.random() < 1 / 1000 * 4 * chanceFactor * dt || fewInLowerPortion()) {
                    x = randomXPosition();
                    y = canvasHeight + fbRadius;
                    fbArray.push(createFb(x, y));
                }
            },
            
            // PLAY:
            play = function () {
                var
                    game = createGame(),
                    die = function () {
                        if (game.dead) { return; }
                        game.dead = true;
                        if (game.previewPlatfmTouch) {
                            game.previewPlatfmTouch = copyTouch(game.previewPlatfmTouch); // This means that when the player dies, when he/she moves the touch it doens't effect the preview.
                        }
                        redrawBtnLayer(game);
                        //clearBtnLayer();
                    },
                    addToActivePowerups = function (type) {
                        var newActive = createActivePowerup(type);
                        var i;
                        for (i = 0; i < game.activePowerups.length; i += 1) {
                            if (game.activePowerups[i].type === type) {
                                game.activePowerups[i] = newActive;
                                return;
                            }
                        }
                        game.activePowerups.push(newActive);
                    },
                    handleActivesPoints = function (pointsReceived) {
                        var i;
                        for (i = 0; i < game.activePowerups.length; i += 1) {
                            if (game.activePowerups[i].type === "X2") {
                                return pointsReceived * 2;
                            }
                        }
                        return pointsReceived;
                    },
                    slowPowerupObtained = function () {
                        var i;
                        for (i = 0; i < game.activePowerups.length; i += 1) {
                            if (game.activePowerups[i].type === "slow") {
                                return true;
                            }
                        }
                        return false;
                    },
                    weightObtained = function () {
                        var i;
                        for (i = 0; i < game.activePowerups.length; i += 1) {
                            if (game.activePowerups[i].type === "weight") {
                                return true;
                            }
                        }
                        return false;
                    },
                    xShifter = function (dx) {
                        return function (obj) {
                            obj.x += dx;
                        };
                    },
                    magnetObtained = function () {
                        var i;
                        for (i = 0; i < game.activePowerups.length; i += 1) {
                            if (game.activePowerups[i].type === "magnet") {
                                return true;
                            }
                        }
                        return false;
                    },
                    updatePlayer = function (dt, totalPoints) {
                        var i, platfm, tmpVel, collided = false;
                        if (game.player.y > canvasHeight + playerRadius) {
                            die();
                            // The frame finishes, with all other components also
                            // being updated before the GameOver screen apperas, so
                            // so does the player's position. This is why there is
                            // no 'return;' here.
                        }
                        for (i = 0; i < game.platfms.length; i += 1) {
                            platfm = game.platfms[i];
                            if (playerIntersectingPlatfm(game.player, platfm)) {
                                tmpVel = velFromPlatfm(dt, game.player, platfm);
                                game.player.vx = tmpVel.x;
                                game.player.vy = tmpVel.y;
                                collided = true;
                            }
                        }
                        if (!collided) {
                            if (weightObtained()) {
                                game.player.vy += playerGrav * 5 / 2 * dt;
                            } else {
                                game.player.vy += playerGrav * dt;
                            }
                        }
                        game.player.ducking = false;
                        for (i = 0; i < game.fbs.length; i += 1) {
                            if (game.player.ducking === false && playerHeadNearFb(game.player, game.fbs[i])) {
                                game.player.ducking = true;
                            }
                            if (playerHittingFb(game.player, game.fbs[i])) {
                                die();
                            }
                        }
                        game.coins.forEach(function (coin, index) {
                            if (playerHittingCoin(game.player, coin)) {
                                game.coins.splice(index, 1);
                                var s = difficultyCurve(totalPoints);
                                console.log(coinValue, "*", s, "=", coinValue * s);
                                game.points += handleActivesPoints(coinValue * s);
                            }
                        });
                        game.powerups.forEach(function (powerup, key) {
                            if (playerHittingPowerup(game.player, powerup)) {
                                game.powerups[key] = null;
                                addToActivePowerups(powerup.type);
                            }
                        });
                        var dx = game.player.vx * dt / 20, dy = game.player.vy * dt / 20;
                        game.player.x = modulo(game.player.x + dx, canvasWidth);
                        game.player.y += dy;
                        game.player.wheelAngle += signNum(game.player.vx) * 0.2 * dt;
                    },
                    updateFbs = function (dt) {
                        updateFbsGeneric(game, dt);
                    },
                    addDiagPattern = function (do_rtl) {
                        // If do_rtl is truthy, the diag pattern
                        // will go down-and-left from the right.
                        var amt = 11;
                        var i, xPos;
                        for (i = 0; i < amt; i += 1) {
                            xPos = (i + 1) * canvasWidth / (amt + 1);
                            if (do_rtl) { xPos = canvasWidth - xPos; }
                            game.coins.push(createCoin(
                                xPos,
                                i * 20 + canvasHeight + coinRadius
                            ));
                        }
                    },
                    updateCoins = function (dt) {
                        var magnetOn = magnetObtained();
                        game.coins.forEach(function (coin, index) {
                            coin.y -= coinFallRate * dt;
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
                        var chanceFactor;
                        if (Math.random() < 1 / (1000 * 25) * dt) {
                            addDiagPattern(Math.random() < 0.5);
                        } else {
                            chanceFactor = 1 / 7;
                            if (Math.random() < 1 / (1000 * 10/4) * chanceFactor * 4 * dt) {
                                game.coins.push(
                                    createCoin(
                                        randomXPosition(),
                                        canvasHeight + coinRadius
                                    )
                                );
                            }
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
                    tryToAddPlatfmFromTouch = function (touch, resolver) {
                        var tx0 = touch.x0;
                        if (touchIsNaNMaker(touch)) {
                            return;
                        }
                        if (touch.x0 === touch.x1) {
                            tx0 -= 1;
                        }
                        game.platfms.push(createPlatfm(tx0, touch.y0, touch.x1, touch.y1));
                        if (typeof resolver === "function") {
                            resolver();
                        }
                    },
                    makePowerupRandom = function (type, start, range) {
                        return createPowerup(Math.random() * range + start, type);
                    },
                    updatePowerups = function (dt) {
                        game.powerups.forEach(function (powerup, key) {
                            powerup.lifetime += dt;
                            if (powerup.xPos() > canvasWidth + 20) { // 20 is just a random margin to be safe
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
                    updateActivePowerups = function (dt) {
                        game.activePowerups.forEach(function (activePowerup, index) {
                            if (activePowerup.lifetime <= 0) {
                                game.activePowerups.splice(index, 1);
                            }
                            activePowerup.lifetime -= dt;
                        });
                    },
                    difficultyCurve = function (x) {
                        return Math.log2(x + 100) / 37 + 0.67;
                    },
                    restart = function () {
                        // The interval isn't cleared because the same interval
                        // is used for the next game (after the restart).
                        game = createGame();
                    },
                    prevFrameTime = Date.now();
                setCurGame(game);
                setInterval(function () {
                    window.game = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.
                    // Handle time (necessary, regardless of pausing)
                    var now = Date.now(), realDt = now - prevFrameTime, dt;
                    realDt *= difficultyCurve(game.points);
                    if (slowPowerupObtained()) {
                        dt = realDt * 2/3; // Sloooooooow
                    } else {
                        dt = realDt;
                    }
                    prevFrameTime = now;
                    
                    // Handle state changes
                    if (game.paused) {
                        drawGamePaused(game);
                    } else if (game.dead) {
                        drawGameDead(game);
                    } else {
                        // Update state
                        if (curTouch && playerIntersectingPlatfm(game.player, curTouch)) {
                            tryToAddPlatfmFromTouch(curTouch, function () { curTouch = null; });
                        }
                        updatePlayer(dt, game.points);
                        updateCoins(dt);
                        updateFbs(dt);
                        updatePlatfms(dt);
                        updatePowerups(dt);
                        updateActivePowerups(dt);
                        game.points += handleActivesPoints(7 * (realDt / 1000) * Math.sqrt(Math.max(0, game.player.y / canvasHeight))); // The use of realDt (rather than dt) here means that when you get the slow powerup, you still get points at normal speed.
                        // Point logic from Elm:
                        //  points <- g.points + 2 * (Time.inSeconds dt) * (1 + g.player.pos.y / toFloat game_total_height) + points_from_coins
                        
                        // Render
                        if (!game.dead && !game.paused) { // The paused check is just in case of a bug, or for the future, as now one cannot pause while drawing a platfm
                            game.previewPlatfmTouch = curTouch;
                        }
                        if (game.dead) {
                            highscores.sendScore(Math.floor(game.points));
                        }
                        drawGame(game);
                    }
                }, 1000 / framerate);
                handleTouchend = function (touch) {
                    if (!game.paused && !game.dead) {
                        tryToAddPlatfmFromTouch(touch);
                    }
                };
                redrawBtnLayer(game);
                jQuery(document).on("click", function (event) {
                    var q, p;
                    if (game.paused) { // Tap *anywhere* to unpause
                        game.paused = false;
                    } else if (game.dead) { // Tap *anywhere* to restart from GameOver screen.
                        restart();
                    } else { // Tap on the pause btn to pause
                        q = calcTouchPos(event);
                        p = {
                            "x1": q.x,
                            "y1": q.y
                        };
                        if (isOverPauseBtn(p)) {
                            game.paused = true;
                        } else if (isOverRestartBtn(p)) {
                            restart();
                        }
                    }
                    redrawBtnLayer(game);
                });
                (function () {
                    var lastRedraw,
                        pauseBtnSensitivityRadius = pauseBtnRadius * 1.2, // The '* 1.2's are present to ensure that when someone drags their finger off the btn, as the finger leaves the btn, the btn will get redrawn (in the inactive state).
                        restartBtnSensitivityRadius = restartBtnRadius * 1.2;
                    jQuery(document).on("touchmove touchstart touchend", function (event) {
                        var now = Date.now(),
                            dt = lastRedraw === undefined ? 1000 : now - lastRedraw, // The defaulting to 1000 just allows the 'dt > 30' test below to definitely pass even on the first draw.
                            touch = calcTouchPos(event.originalEvent.changedTouches[0]);
                        if (dt > 30 && // This ensures that it won't render WAY too often when the finger is over the button, which would slow the game down.
                                (dist(pauseBtnCenterX, pauseBtnCenterY, touch.x, touch.y) < pauseBtnSensitivityRadius ||
                                 dist(restartBtnCenterX, restartBtnCenterY, touch.x, touch.y) < restartBtnSensitivityRadius)) {
                            redrawBtnLayer(game);
                            lastRedraw = now;
                        }
                    });
                }());
            },
            createMenu = function () { return {fbs: [], firebitsRed: [], firebitsOrg: []}; },
            runMenu = function () {
                var menu = createMenu(),
                    updateFbs = function (dt) {
                        updateFbsGeneric(menu, dt);
                    },
                    intervalId,
                    prevTime = Date.now();
                window.menu = menu;
                intervalId = setInterval(function () {
                    var now = Date.now(), dt = now - prevTime;
                    prevTime = now;
                    updateFbs(dt);
                    drawMenu(menu);
                }, 1000 / framerate);
                jQuery(document).on("click.menuHandler", function (event) {
                    var pos = calcTouchPos(event), tpos = {"x1": pos.x, "y1": pos.y};
                    if (isOverPlayBtn(tpos)) {
                        clearInterval(intervalId);
                        jQuery(document).off(".menuHandler");
                        play();
                    }
                });
            };
        return {runMenu: runMenu, play: play};
    }());
    start.runMenu();
}());