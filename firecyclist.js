// (c) Wilson Berkow
// Firecyclist.js

if (!Math.log2) {
    Math.log2 = function (e) {
        return Math.log(e) / Math.log(2);
    };
}

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
            var highscores = [null, null, null], // Highest scores are at the beginning, null represents an empty slot.
                fromLocal = localStorage.getItem("highscores");
            if (fromLocal !== null) {
                fromLocal = JSON.parse(fromLocal);
                if (fromLocal) {
                    highscores = fromLocal;
                }
            }
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
                    var i, result = false;
                    for (i = 0; i < highscores.length; i += 1) {
                        if (score > highscores[i] || highscores[i] == null) {
                            highscores.splice(i, 0, score);
                            highscores.splice(highscores.length - 1, 1);
                            result = true;
                            break;
                        }
                    }
                    localStorage.setItem("highscores", JSON.stringify(highscores));
                    return result;
                }
            };
        }());
    resize();
    (function () { // Simple Touch system, similar to Elm's but compatible with the Platfm interface
        var touchesCount = 0;
        jQuery(document).on("touchmove", function (event) {
            var xy = calcTouchPos(event);
            if (curTouch !== null) { // Condition fails when a platfm has been materialized, and thus curTouch was reset to null
                curTouch.x1 = xy.x;
                curTouch.y1 = xy.y;
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
                "x1":  xy.x,
                "y1":  xy.y
            };
            touchesCount += 1;
        });
        jQuery(document).on("touchend", function (event) {
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
        isOverPauseBtn = function (xy) {
            return dist(xy.x1, xy.y1, pauseBtnCenterX, pauseBtnCenterY) < pauseBtnRadius;
        },
        isOverRestartBtn = function (xy) {
            return dist(xy.x1, xy.y1, restartBtnCenterX, restartBtnCenterY) < restartBtnRadius;
        },
        
        // CONFIG:
        framerate = 50,
        canvasWidth = 576 / 2,
        canvasHeight = 1024 / 2,
        playerGrav = 0.3 / 28,
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
        menuPlayBtnY = 310,
        menuPlayBtnW = 121,
        menuPlayBtnH = 44,
        powerupX2Width = 36,
        powerupX2Height = 30,
        powerupX2ApproxRadius = avg(powerupX2Height / 2, pythag(powerupX2Width, powerupX2Height) / 2), // Average of the short and long radii.
        powerupSlowRadius = 10,
        activePowerupLifespan = 10000,
        fireRed = "rgb(230, 0, 0)";
    
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
                drawBackground(ctx);
                drawPlayerAt(ctx, game.player.x, game.player.y, game.player.wheelAngle);
                setupGenericPlatfmChars(ctx);
                game.platfms.forEach(function (platfm) {
                    drawPlatfm(ctx, platfm);
                });
                ctx.globalAlpha = 1; // Changed in platfm drawing, so must be reset
                if (game.previewPlatfmTouch) {
                    drawPreviewPlatfm(ctx, game.previewPlatfmTouch);
                }
                drawFirebits(ctx, game.firebits);
                drawFbs(ctx, game.fbs);
                game.coins.forEach(function (coin) {
                    drawCoin(ctx, coin);
                });
                game.powerups.forEach(function (powerup) {
                    drawPowerup(powerup.type, powerup.xPos(), powerup.yPos());
                });
                drawActivePowerups(game.activePowerups);
                drawPauseBtn(ctx, game);
                drawRestartBtn(ctx, game);
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
                ctx.font = "bold italic 28px monospace";
                ctx.fillText("Highscores", canvasWidth / 2, 410);
                var scoreFontSize = 24;
                ctx.font = "bold " + scoreFontSize + "px monospace";
                var curY = 435;
                highscores.highest().forEach(function (score) {
                    if (!score) { return; }
                    ctx.fillText(score, canvasWidth / 2, curY);
                    curY += scoreFontSize + 2;
                });
            }),
            drawBackground = function (ctx) {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = "rgba(175, 175, 255, 0.75)"
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            },
            drawPlayerAt = function (ctx, x, y, angle) {
                ctx.beginPath();
                circleAt(ctx, x, y - playerTorsoLen - playerRadius - playerHeadRadius, playerHeadRadius, 0, 2 * Math.PI, true);
                ctx.moveTo(x, y - playerTorsoLen - playerRadius);
                ctx.lineTo(x, y); // (x, y) is the center of the wheel
                
                ctx.save();
                ctx.translate(x, y - playerRadius - playerTorsoLen / 2);
                oneArm(ctx, x, y);
                oneArm(ctx, x, y, true);
                ctx.restore();
                
                wheelAt(ctx, x, y, angle);
                
                ctx.stroke();
            },
            oneArm = function (ctx, x, y, reverse) {
                if (reverse) {
                    ctx.scale(-1, -1);
                }
                ctx.moveTo(0, 0);
                ctx.lineTo(-playerElbowXDiff, -playerElbowYDiff);
                ctx.lineTo(-2 * playerElbowXDiff, playerElbowYDiff);
            },
            wheelAt = function (ctx, x, y, angle) {
                var i;
                circleAt(ctx, x, y, playerRadius, 0, 2 * Math.PI, true);
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle * Math.PI / 180);
                for (i = 0; i < 6; i += 1) {
                    ctx.moveTo(-playerRadius, 0);
                    ctx.lineTo(playerRadius, 0);
                    if (i !== 5) {
                        ctx.rotate(1/3 * Math.PI); // Rotate a sixth of a turn
                    }
                }
                ctx.restore();
            },
            objIsVisible = function (width, obj) {
                return obj.x > -width && obj.x < canvasWidth + width;
            },
            drawFbs = function (ctx, fbs) {
                var scaleFactor = 10 / 12.6, // To get it to the right size
                    ctrlX = 0 * scaleFactor,
                    ctrlY = 19 * scaleFactor,
                    curveEndY = 19 * scaleFactor - ctrlY,
                    curveXMiddle = ctrlX,
                    curveRightestEndX = 11.9 * scaleFactor,
                    curveLeftestEndX = -11.9 * scaleFactor,
                    curveTipY = ctrlY + 9 * scaleFactor,
                    radius = 12.6 * scaleFactor;
                var triColor = "darkRed", ballColor = "darkRed";
                ctx.beginPath();
                fbs.forEach(function (fb) {
                    if (!objIsVisible(2 * fbRadius, fb)) { return; }
                    ctx.moveTo(fb.x + ctrlX, fb.y + curveTipY);
                    ctx.quadraticCurveTo(fb.x + ctrlX, fb.y + ctrlY, fb.x + curveRightestEndX, fb.y + curveEndY);
                    ctx.moveTo(fb.x + ctrlX, fb.y + curveTipY);
                    ctx.quadraticCurveTo(fb.x + ctrlX, fb.y + ctrlY, fb.x + curveLeftestEndX, fb.y + curveEndY);
                });
                ctx.lineWidth = 2;
                ctx.strokeStyle = triColor;
                ctx.stroke();
                ctx.beginPath();
                fbs.forEach(function (fb) {
                    if (!objIsVisible(2 * fbRadius, fb)) { return; }
                    ctx.moveTo(fb.x + ctrlX, fb.y + curveTipY - 4 * scaleFactor);
                    ctx.lineTo(fb.x + 9 * scaleFactor, fb.y + curveEndY);
                    ctx.lineTo(fb.x - 9 * scaleFactor, fb.y + curveEndY);
                    ctx.closePath();
                    ctx.arc(fb.x, fb.y, radius, 0, Math.PI * 2, true);
                });
                ctx.fillStyle = triColor;
                ctx.fill();
            },
            drawFirebits = function (ctx, firebits) {
                var i;
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = "darkOrange";
                for (i = 0; i < firebits.length; i += 1) {
                    if (objIsVisible(1.3, firebits[i])) {
                        circleAt(ctx, firebits[i].x, firebits[i].y, Math.random() + 0.3);
                    }
                }
                ctx.stroke();
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
            drawPauseBtn = function (ctx, game) {
                var colory = !game.dead && (game.paused || (curTouch && isOverPauseBtn(curTouch)));
                ctx.beginPath();
                ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)"
                ctx.arc(pauseBtnCenterX, pauseBtnCenterY, pauseBtnRadius, 0, 2 * Math.PI, true);
                ctx.fill();
                ctx.font = "bold " + pxSize + "px arial";
                fillShadowyText(ctx, "II", 15, 15 + pxSize / 2, colory);
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
                    ctx.fillStyle = "rgba(" + (colory ? 225 : 150) + ", " + (colory ? 175 : 150) + ", 150, 0.25)"
                    ctx.arc(restartBtnCenterX, restartBtnCenterY, restartBtnRadius, 0, 2 * Math.PI, true);
                    ctx.fill();
                    if (colory) {
                        ctx.drawImage(offCanvasOrange, canvasWidth - 25 - pxSize / 2, -13 + pxSize / 2, pxSize, pxSize);
                    } else {
                        ctx.drawImage(offCanvasBlack, canvasWidth - 25 - pxSize / 2, -13 + pxSize / 2, pxSize, pxSize);
                    }
                };
            }()),
            drawInGamePoints = drawer(function (ctx, points) {
                ctx.textAlign = "center";
                ctx.font = "bold " + inGamePointsPxSize + "px monospace";
                fillShadowyText(ctx, Math.floor(points), canvasWidth / 2, inGamePointsYPos);
            }),
            drawPowerup = drawer(function (ctx, type, x, y) {
                if (type === "X2") {
                    ctx.fillStyle = "gold";
                    ctx.font = "italic 26px monospace";
                    ctx.fillText("X2", x, y, powerupX2Width, powerupX2Height);
                    ctx.strokeStyle = "orange";
                    ctx.strokeText("X2", x, y, powerupX2Width, powerupX2Width);
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
                }
            }),
            drawActivePowerups = drawer(function (ctx, actives) {
                var xPos = canvasWidth / 2 + inGamePointsPxSize, yPos = inGamePointsYPos, i;
                for (i = actives.length - 1; i >= 0; i -= 1) { // Start with the last activepowerups, which have been around the longest.
                    drawPowerup(actives[i].type, xPos, yPos);
                    xPos += actives[i].width;
                }
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
            circleAt = function (ctx, x, y, radius) {
                ctx.moveTo(x + radius, y); // A line is always drawn from the current position to the start of the drawing of the circle, so the '+ radius' puts the brush at that point on the circle, (x+radius, y), to prevent extraneous lines from being painted.
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
            },
            lineFromTo = function (ctx, x0, y0, x1, y1) {
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
            },
            drawMenu = drawer(function (ctx, menu) {
                drawBackground(ctx);
                drawFirebits(ctx, menu.firebits);
                drawFbs(ctx, menu.fbs);
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
        return [drawGame, drawGamePaused, drawGameDead, drawMenu];
    }());
    var drawGame = renderers[0], drawGamePaused = renderers[1], drawGameDead = renderers[2], drawMenu = renderers[3];
    
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
            touchToPlatfm = function (touch) {
                return createPlatfm(touch.x0, touch.y0, touch.x1, touch.y1);
            },
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
            touchIsNaNMaker = function (touch) {
                return touch.x0 === touch.x1 && touch.y0 === touch.y1
            },
            createCoin = function (x, y) {
                return {"is": "coin", "x": x, "y": y};
            },
            createFb = function (x, y) {
                return {"is": "fb", "x": x, "y": y};
            },
            createFirebit = function (x, y) {
                return {"is": "fbBit", "x": x, "y": y, "lifetime": 225 + Math.random() * 50};
            },
            createVel = anglify(false, function (vx, vy) {
                return {"is": "vel", "vx": vx, "vy": vy};
            }),
            createPowerup = (function () {
                var proto = {
                    xDistanceTravelled: function () {
                        return this.lifetime / powerupTotalLifespan * canvasWidth;
                    },
                    xPos: function () {
                        return this.xDistanceTravelled() - this.offsetX;
                    },
                    yPos: function () {
                        return this.offsetY + Math.sin(this.xDistanceTravelled() / 20) * 40;
                    }
                };
                return function (y, powerupType) {
                    // offsetX is for the scrolling effect.
                    return makeObject(proto, {"is": "powerup", "offsetY": y, "offsetX": 0, "lifetime": 0, "type": powerupType});
                };
            }()),
            createActivePowerup = function (type) {
                return {
                    "is": "activePowerup",
                    "type": type,
                    "width": type === "X2"   ? powerupX2Width :
                             type === "slow" ? powerupSlowRadius * 2 :
                             0,
                    "lifetime": type === "slow" ? activePowerupLifespan / 2 : activePowerupLifespan,
                }; // TODO: INCLUDE srcX, srcY, timeSinceAcquired FOR ANIMATIONS
            },
            createGame = function () {
                return {
                    "player": createPlayer(canvasWidth / 2, 50, 0, 0),
                    "platfms": [],
                    "previewPlatfmTouch": null,
                    "fbs": [],
                    "firebits": [],
                    "coins": [],
                    "powerups": [],
                    "activePowerups": [],
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
            playerHittingCircle = function (player, x, y, circleRadius) {
                return dist(player.x, player.y, x, y) < playerRadius + circleRadius
                    || dist(player.x, player.y - playerRadius - playerTorsoLen - playerHeadRadius, x, y) < playerHeadRadius + circleRadius;
            },
            playerHittingFb = function (player, fb) {
                return playerHittingCircle(player, fb.x, fb.y, fbRadius);
            },
            playerHittingCoin = function (player, coin) {
                return playerHittingCircle(player, coin.x, coin.y, coinRadius);
            },
            playerHittingPowerup = function (player, powerup) {
                if (powerup.type === "X2") {
                    return playerHittingCircle(player, powerup.xPos(), powerup.yPos(), powerupX2ApproxRadius);
                } else if (powerup.type === "slow") {
                    return playerHittingCircle(player, powerup.xPos(), powerup.yPos(), powerupSlowRadius);
                }
            },
            randomXPosition = function () {
                return Math.random() * canvasWidth * 3 - canvasWidth * 1.5;
            },
            makeFirebitAround = function (fbX, fbY) {
                var x = fbX + Math.random() * 1.5 * fbRadius - 0.75*fbRadius,
                    y = fbY + Math.random() * fbRadius;
                return createFirebit(x, fbY);
            },
            updateFbsGeneric = function (obj, dt) { // This is used in both playGame and runMenu, and thus must be declared here.
                var fbArray = Array.isArray(obj) ? obj : obj.fbs,
                    fbFirebits = Array.isArray(obj) ? null : obj.firebits,
                    x, y;
                // fbArray can't be abstracted out and used in closure, because
                // every new game uses a different 'fbs' array and 'game' object
                fbArray.forEach(function (fb, index) {
                    fb.y -= fbFallRate * dt;
                    if (fb.y < -totalFbHeight) {
                        fbArray.splice(index, 1);
                    }
                    if (fbFirebits) {
                        fbFirebits.push(makeFirebitAround(fb.x, fb.y));
                    }
                });
                (fbFirebits || []).forEach(function (firebit, index) {
                    firebit.y += Math.random() * 1.5 + 0.1;
                    firebit.x += Math.random() * 1.5 - 1;
                    firebit.lifetime -= dt;
                    if (firebit.lifetime <= 0 || firebit.y > canvasHeight || firebit.x < 0 || firebit.x > canvasWidth) {
                        fbFirebits.splice(index, 1);
                    }
                });
                if (Math.random() < 1 / 1000 * 4 * dt) {
                    x = randomXPosition();
                    y = canvasHeight + fbRadius;
                    fbArray.push(createFb(x, y));
                }
            },
            
            // PLAY:
            playGame = function () {
                var
                    game = createGame(),
                    handleActivesPoints = function ($$$) {
                        var i;
                        for (i = 0; i < game.activePowerups.length; i += 1) {
                            if (game.activePowerups[i].type === "X2") { // These powerups don't stack. TODO: Consider changing rendering to reflect this.
                                return $$$ * 2;
                            }
                        }
                        return $$$;
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
                    xShifter = function (dx) {
                        return function (obj) {
                            obj.x += dx;
                        };
                    },
                    shiftAllOtherXs = function (dx) {
                        var shift = xShifter(dx);
                        game.fbs.forEach(shift);
                        game.coins.forEach(shift);
                        game.firebits.forEach(shift);
                        game.powerups.forEach(shift);
                        game.platfms.forEach(function (platfm) {
                            platfm.x0 += dx;
                            platfm.x1 += dx;
                        });
                    },
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
                                tmpVel = velFromPlatfm(dt, game.player, platfm);
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
                            var i;
                            if (playerHittingCoin(game.player, coin)) {
                                game.coins.splice(index, 1);
                                game.points += handleActivesPoints(coinValue);
                            }
                        });
                        game.powerups.forEach(function (powerup, index) {
                            if (playerHittingPowerup(game.player, powerup)) {
                                game.powerups.splice(index, 1);
                                if (powerup.type === "X2") {
                                    game.activePowerups.push(createActivePowerup("X2"));
                                } else if (powerup.type === "slow") {
                                    game.activePowerups.push(createActivePowerup("slow"));
                                }
                            }
                        });
                        var dx = game.player.vx * dt / 20, dy = game.player.vy * dt / 20;
                        if (true){//(game.player.x < canvasWidth / 4 && game.player.vx < 0) || (game.player.x > canvasWidth * 3 / 4 && game.player.vx > 0)) {
                            shiftAllOtherXs(-dx);
                        } else {
                            game.player.x += dx;
                            game.player.x = modulo(game.player.x, canvasWidth);
                        }
                        game.player.y += dy;
                        game.player.wheelAngle += signNum(game.player.vx) * 0.2 * dt;
                    },
                    updateFbs = function (dt) {
                        updateFbsGeneric(game, dt);
                    },
                    updateCoins = function (dt) {
                        game.coins.forEach(function (coin, index) {
                            coin.y -= coinFallRate * dt;
                            if (coin.y < -2 * coinRadius) {
                                game.coins.splice(index, 1);
                            }
                        });
                        if (Math.random() < 1 / (1000 * 10/4) * 4 * dt) { // The '* 10/4' is drawn from the use of the 'likelihood' argument in 'randomly_create_x'
                            game.coins.push(createCoin(randomXPosition(), canvasHeight + coinRadius));
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
                    tryToAddPlatfmFromTouch = function (touch) {
                        var tx0 = touch.x0;
                        if (touchIsNaNMaker(touch)) {
                            return;
                        }
                        if (touch.x0 === touch.x1) {
                            tx0 -= 1;
                        }
                        game.platfms.push(createPlatfm(tx0, touch.y0, touch.x1, touch.y1));
                    },
                    makePowerupRandom = function (type, start, range) {
                        return createPowerup(Math.random() * range + start, type);
                    },
                    updatePowerups = function (dt) {
                        game.powerups.forEach(function (powerup, index) {
                            powerup.lifetime += dt;
                            if (powerup.xPos() > canvasWidth + 20) { // 20 is just a random margin to be safe
                                game.powerups.splice(index, 1);
                            }
                        });
                        if (Math.random() < 1 / 75000 * dt) { // 100 times less frequent than fireballs
                            game.powerups.push(makePowerupRandom("X2", 25, 110));
                        }
                        if (Math.random() < 1 / 75000 * dt) {
                            game.powerups.push(makePowerupRandom("slow", 25, 145));
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
                        return Math.log2(x + 0.1) / 80 + 0.85;
                    },
                    die = function () {
                        if (game.dead) { return; }
                        game.dead = true;
                        if (game.previewPlatfmTouch) {
                            game.previewPlatfmTouch = copyTouch(game.previewPlatfmTouch); // This means that when the player dies, when he/she moves the touch it doens't effect the preview.
                        }
                    },
                    restart = function () {
                        // intervalId isn't cleared because the same interval is
                        // used for the next game (after the restart).
                        game = createGame();
                    },
                    prevFrameTime = Date.now(),
                    intervalId;
                window.game = game; // FOR DEBUGGING. It is a good idea to have this in case I see an issue at an unexpected time.
                intervalId = setInterval(function () {
                    // Handle time (necessary, regardless of pausing)
                    var now = Date.now(), dt = now - prevFrameTime;
                    if (slowPowerupObtained()) {
                        dt = dt * 2/3; // Sloooooooow
                    }
                    //if () {
                        // SCALE dt BY PROGRESS FOR DIFFICULTY CURVE
                        //  This also is good because it means that you'll get points faster over time
                        // For now, just testing...
                        dt *= difficultyCurve(game.points);
                    //}
                    prevFrameTime = now;
                    
                    // Handle state changes
                    if (game.paused) {
                        drawGamePaused(game);
                    } else if (game.dead) {
                        drawGameDead(game);
                    } else {
                        // Update state
                        if (curTouch && playerIntersectingPlatfm(game.player, curTouch)) {
                            tryToAddPlatfmFromTouch(curTouch);
                            curTouch = null;
                        }
                        updatePlayer(dt);
                        updateCoins(dt);
                        updateFbs(dt);
                        updatePlatfms(dt);
                        updatePowerups(dt);
                        updateActivePowerups(dt);
                        game.points += handleActivesPoints(2 * (dt / 1000) * (1 + game.player.y / canvasHeight));
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
                    var tx0 = touch.x0;
                    if (!game.paused && !game.dead) {
                        tryToAddPlatfmFromTouch(touch);
                    }
                };
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
                });
            },
            createMenu = function () { return {fbs: [], firebits: []}; },
            runMenu = function () {
                var menu = createMenu(),
                    updateButtons = function () {},
                    updateFbs = function (dt) {
                        updateFbsGeneric(menu, dt);
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