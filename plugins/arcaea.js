class ArcaeaEvent {
    constructor(time) {
        this.time = time;
    }
}

class ArcaeaTimingEvent extends ArcaeaEvent {
    /**
     * 
     * @param {number} time 
     * @param {number} bpm 
     * @param {number} beatsPerLine 
     */
    constructor(time, bpm, beatsPerLine) {
        super(time);
        this.bpm = bpm;
        this.beatsPerLine = beatsPerLine;
    }
}

class ArcaeaTapEvent extends ArcaeaEvent {
    constructor(time, lane) {
        super(time);
        this.lane = lane;
    }
}

class ArcaeaHoldEvent extends ArcaeaEvent {
    constructor(time, endTime, lane) {
        super(time);
        this.endTime = endTime;
        this.lane = lane;
    }
}

class ArcaeaTimingGroup {
    constructor(isPrimary) {
        this.isPrimary = isPrimary;

        /** @type {ArcaeaEvent[]} */
        this.events = [];
    }

    getBaseBPM() {
        return this.events.find(n => {
            return n instanceof ArcaeaTimingEvent;
        }).bpm;
    }
}

class ArcaeaArctapEvent extends ArcaeaEvent {
    /**
     * 
     * @param {number} time 
     * @param {ArcaeaArcEvent} arc 
     */
    constructor(time, arc) {
        super(time);
        this.parent = arc;
    }
}

class ArcaeaArcEvent extends ArcaeaEvent {
    constructor(time, endTime, xStart, xEnd, lineType, yStart, yEnd, color, isVoid) {
        super(time);
        this.endTime = endTime;
        this.start = {
            x: xStart, y: yStart
        };
        this.end = {
            x: xEnd, y: yEnd
        };
        this.lineType = lineType;
        this.color = color;
        this.isVoid = isVoid;

        /** @type {ArcaeaArctapEvent[]} */
        this.arcTaps = [];
    }

    static readLine(line) {
        if(!line.startsWith("arc(")) throw new Error("The given line is not an arc event.");
        var regex = /arc\((\d+?),(\d+?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?)\)(?:\[(.*?)\])?;/;
        var event = line.match(regex);

        var arc = new ArcaeaArcEvent(
            parseFloat(event[1]),   // time
            parseFloat(event[2]),   // endTime
            parseFloat(event[3]),   // xStart
            parseFloat(event[4]),   // xEnd
            event[5],   // lineType
            parseFloat(event[6]),   // yStart
            parseFloat(event[7]),   // yEnd
            parseInt(event[8]),     // color
            event[10] == "true"     // isVoid
        );

        var arctaps = event[11];
        if(arctaps) {
            var t = arctaps.split(",");
            t.forEach(n => {
                arc.arcTaps.push(new ArcaeaArctapEvent(
                    parseFloat(n.substring("arctap(".length, n.length - 1)), arc
                ));
            });
        }

        return arc;
    }
}

class ArcaeaChart {
    constructor() {
        this.offset = 0;
        
        /** @type {ArcaeaTimingGroup[]} */
        this.timingGroups = [];
    }

    getPrimaryGroup() {
        return this.timingGroups.find(n => {
            return n.isPrimary;
        });
    }

    static async load(basePath, diff, arcDensity = 1, speedMultiplier = 1) {
        game.chart = Chart.fromArcaea(ArcaeaChart.deserialize(await (await fetch(`${basePath}/${diff}.aff`)).text()), arcDensity, speedMultiplier);
        await game.loadAudio(`${basePath}/base.ogg`);
    }

    /**
     * 
     * @param {string} raw 
     */
    static deserialize(raw) {
        var chart = new ArcaeaChart();
        var primaryGroup = new ArcaeaTimingGroup(true);
        chart.timingGroups.push(primaryGroup);
        var targetGroup = primaryGroup;

        var state = 0;

        raw.split("\n").forEach((line, i) => {
            if(state == 0) {
                // First line:
                // AudioOffset:N (ms)
                if(line.startsWith("AudioOffset:")) {
                    chart.offset = parseFloat(line.substring("AudioOffset:".length));
                    return;
                }

                if(line.trim() == "-") {
                    state++;
                    return;
                }
            }

            if(state == 1) {
                if(line.startsWith("timinggroup(")) {
                    var group = new ArcaeaTimingGroup(false);
                    chart.timingGroups.push(group);
                    targetGroup = group;
                } else if(line.startsWith("};")) {
                    targetGroup = primaryGroup;
                } else if(line.startsWith("timing(")) {
                    var event = line.substring("timing(".length, line.length - 2).split(",");
                    targetGroup.events.push(new ArcaeaTimingEvent(
                        parseFloat(event[0]), parseFloat(event[1]), parseFloat(event[2])
                    ));
                } else if(line.startsWith("(")) {
                    // Single Note
                    var event = line.substring(1, line.length - 2).split(",");
                    targetGroup.events.push(new ArcaeaTapEvent(
                        parseFloat(event[0]), parseFloat(event[1]),
                    ));
                } else if(line.startsWith("arc(")) {
                    targetGroup.events.push(ArcaeaArcEvent.readLine(line));
                } else if(line.startsWith("hold(")) {
                    // Single Hold note
                    var event = line.substring("hold(".length, line.length - 2).split(",");
                    targetGroup.events.push(new ArcaeaHoldEvent(
                        parseFloat(event[0]), parseFloat(event[1]), parseFloat(event[2])
                    ));
                }
            }
        });
        return chart;
    }
}

var ArcaeaEasing = {
    S: (a, b, t) => {
        return (1 - t) * a + b * t;
    },
    O: (a, b, t) => {
        return a + (b - a) * (1 - Math.cos(1.5707963 * t));
    },
    I: (a, b, t) => {
        return a + (b - a) * (Math.sin(1.5707963 * t));
    },
    B: (a, b, t) => {
        var o = 1 - t;
        // a^3 + 3a^2b + 3ab^2 + b^3
        return Math.pow(o, 3) * a + 3 * Math.pow(o, 2) * t * a + 3 * o * Math.pow(t, 2) * b + Math.pow(t, 3) * b;
    },

    resolveX: (a, b, t, type) => {
        switch(type) {
            case "s":
                return ArcaeaEasing.S(a, b, t);
            case "b":
                return ArcaeaEasing.B(a, b, t);
        }

        if(type.startsWith("si")) {
            return ArcaeaEasing.I(a, b, t);
        }
        if(type.startsWith("so")) {
            return ArcaeaEasing.O(a, b, t);
        }
        return a + (b - a) * t;
    },
     
    resolveY: (a, b, t, type) => {
        switch(type) {
            case "s":
            case "si":
            case "so":
                return ArcaeaEasing.S(a, b, t);
            case "b":
                return ArcaeaEasing.B(a, b, t);
        }

        if(type.endsWith("si")) {
            return ArcaeaEasing.I(a, b, t);
        }
        if(type.endsWith("so")) {
            return ArcaeaEasing.O(a, b, t);
        }
        return a + (b - a) * t;
    }
}

if(typeof Chart !== "undefined") {
    function laneToX(lane) {
        return K.Maths.lerp(-4, 4, (lane - 1) / 3);
    }

    function arcXToPhigros(x) {
        return K.Maths.lerp(-4, 4, (x + 0.25) / 2 / 3 * 4);
    }

    function arcXToPhigrosLine(x) {
        return K.Maths.lerp(0.275, 0.725, (x + 0.25) / 2 / 3 * 4);
    }

    function arcYToPhigrosAlpha(y) {
        return K.Maths.lerp(0.125, 0.5, Math.max(0, Math.min(1, y)));
    }

    function arcTimeToPhigros(time, bpm) {
        return time / 1875 * bpm;
    }

    /**
     * 
     * @param {ArcaeaChart} arcaea 
     * @param {*} arcDensity 
     */
    Chart.fromArcaea = (arcaea, arcDensity, speedMultiplier = 1) => {
        var chart = new Chart();
        chart.offset = arcaea.offset * -0.001;
        var baseBPM = arcaea.getPrimaryGroup().getBaseBPM();

        arcaea.timingGroups.forEach(g => {
            var arcLine = new JudgeLine();
            var notesLine = new JudgeLine();
    
            arcLine.bpm = baseBPM;
            notesLine.bpm = baseBPM;
    
            var s1 = new StateEvent();
            s1.startTime = 0;
            s1.endTime = 99999999;
            s1.start = 0.5;
            s1.end = 0.5;
            s1.start2 = 0.15;
            s1.end2 = 0.15;
    
            var s2 = new StateEvent();
            s2.startTime = 0;
            s2.endTime = 99999999;
            s2.start = 0.5;
            s2.end = 0.5;
            s2.start2 = 0.15;
            s2.end2 = 0.15;
            
            arcLine.judgeLineMoveEvents.push(s1);
            notesLine.judgeLineMoveEvents.push(s2);

            chart.judgeLineList.push(arcLine, notesLine);
        
            var speeds = [
                { time: -1, endTime: 99999999, speed: 1, beatsPerLine: 4 }
            ];

            /** @type {JudgeLine[]} */
            var voidLines = [];
            var maxTime = 0;

            g.events.filter(ev => ev instanceof ArcaeaTimingEvent).forEach(event => {
                var speed = event.bpm / baseBPM;
                speeds[speeds.length - 1].endTime = arcTimeToPhigros(event.time, baseBPM);
                speeds.push(
                    { time: arcTimeToPhigros(event.time, baseBPM), endTime: 99999999, speed, beatsPerLine: event.beatsPerLine }
                );
                maxTime = Math.max(maxTime, arcTimeToPhigros(event.time, baseBPM));
            });

            var posY = 0;
            speeds.forEach((s, i) => {
                if(i == 0) return;
                
                var floorPosition = posY;
                posY += (s.speed * 1.25 * speedMultiplier) * (s.endTime - s.time) / arcLine.bpm * 1.875;

                var sa = new SpeedEvent();
                sa.startTime = s.time;
                sa.endTime = s.endTime;
                sa.value = s.speed * 1.25 * speedMultiplier;
                sa.floorPosition = floorPosition;
                
                var sn = new SpeedEvent();
                sn.startTime = s.time;
                sn.endTime = s.endTime;
                sn.value = s.speed * 1.25 * speedMultiplier;
                sn.floorPosition = floorPosition;

                arcLine.speedEvents.push(sa);
                notesLine.speedEvents.push(sn);
            });

            let getFloorPosition = time => {
                var event = notesLine.speedEvents.find(e => {
                    return time >= e.startTime && time < e.endTime;
                });
                if(event == null) event = notesLine.speedEvents[0];
                if(event == null) return 0;

                return (event.floorPosition + (time - event.startTime) * 1.875 / notesLine.bpm * event.value) * 0.6;
            };

            speeds.forEach((ev, i) => {
                if (i == 0) return;
                var isLast = i == speeds.length - 1;

                if (ev.speed != 0 && ev.beatsPerLine != 0 && g.isPrimary) {
                    var bpm = notesLine.bpm;
                    var realBpm = Math.abs(ev.speed) * baseBPM;
                    var timePerLine = arcTimeToPhigros(60000 / realBpm * ev.beatsPerLine, baseBPM);
                    for (var t = ev.time; t < (isLast ? (maxTime + 32 * 4) : ev.endTime) - 1; t += timePerLine) {
                        var line = new JudgeLine();
                        line.bpm = bpm;

                        var a2 = new StateEvent();
                        a2.startTime = 0;
                        a2.endTime = t;
                        a2.start = a2.end = 0.5;

                        var a3 = new StateEvent();
                        a3.startTime = t;
                        a3.endTime = 99999999;
                        a3.start = a3.end = 0;
                        line.judgeLineDisappearEvents.push(a2, a3);

                        for (var k=0; k<notesLine.speedEvents.length; k++) {
                            var spev = notesLine.speedEvents[k];
                            var et = Math.min(spev.endTime, t);

                            var currPos0 = getFloorPosition(spev.startTime);
                            var currPos = getFloorPosition(et);
                            var linePos = getFloorPosition(t);

                            var s = new StateEvent();
                            s.startTime = spev.startTime;
                            s.endTime = et;
                            s.start = s.end = 0.5;
                            s.start2 = linePos - currPos0 + 0.15;
                            s.end2 = linePos - currPos + 0.15;
                            line.judgeLineMoveEvents.push(s);

                            if (et == t) break;
                        }

                        chart.judgeLineList.push(line);
                    }                        
                }
            });

            g.events.forEach(event => {
                if(event instanceof ArcaeaTapEvent) {
                    var tap = new TapNote();
                    tap.time = arcTimeToPhigros(event.time, baseBPM);
                    maxTime = Math.max(maxTime, tap.time);
                    tap.positionX = laneToX(event.lane);
                    tap.parent = notesLine;
                    notesLine.notesAbove.push(tap);
                } else if(event instanceof ArcaeaHoldEvent) {
                    var hold = new HoldNote();
                    hold.time = arcTimeToPhigros(event.time, baseBPM);
                    hold.holdTime = arcTimeToPhigros(event.endTime - event.time, baseBPM);
                    maxTime = Math.max(maxTime, hold.time + hold.holdTime);
                    hold.positionX = laneToX(event.lane);
                    hold.parent = notesLine;
                    notesLine.notesAbove.push(hold);
                } else if(event instanceof ArcaeaArcEvent) {
                    // This would be the most complicated process.
                    var aTime = arcTimeToPhigros(event.time, baseBPM);
                    var bTime = arcTimeToPhigros(event.endTime, baseBPM);

                    if(!event.isVoid) {
                        var density = arcDensity;
                        let getSpeed = time => {
                            var ev = notesLine.speedEvents.find(e => {
                                return time >= e.startTime && time < e.endTime;
                            });
                            if(ev == null) event = notesLine.speedEvents[0];
                            if(ev == null) return 1;

                            return ev.value / speedMultiplier / 1.25;
                        };
                        density *= getSpeed(aTime);

                        for(var i = aTime; i < bTime; i += density) {
                            var c = new CatchNote();
                            c.time = i;
                            maxTime = Math.max(maxTime, i);

                            var progress = (i - aTime) / (bTime - aTime);
                            c.positionX = arcXToPhigros(ArcaeaEasing.resolveX(event.start.x, event.end.x, progress, event.lineType));
                            c.parent = arcLine;
                            arcLine.notesAbove.push(c);
                        }
                    } else {
                        /** @type {JudgeLine} */
                        var voidLine = null;
                        
                        for (var i=0; i<voidLines.length; i++) {
                            var line = voidLines[i];
                            var events = line.judgeLineDisappearEvents;
                            var lastEvent = events[events.length - 1];
                            if (lastEvent && lastEvent.startTime <= aTime) {
                                voidLine = line;
                                break;
                            }
                        }

                        if (voidLine == null) {
                            voidLine = new JudgeLine();
                            voidLine.bpm = baseBPM;

                            var a1 = new StateEvent();
                            a1.startTime = -99999999;
                            a1.endTime = aTime;
                            a1.start = a1.end = 0;
                            voidLine.judgeLineDisappearEvents.push(a1);
                            voidLines.push(voidLine);
                        } else {
                            var events = voidLine.judgeLineDisappearEvents;
                            var lastEvent = events[events.length - 1];
                            lastEvent.endTime = aTime;
                        }

                        for(var i = aTime; i < bTime; i++) {
                            var pA = (i - aTime) / (bTime - aTime);
                            var pB = (i+1 - aTime) / (bTime - aTime);

                            var s = new StateEvent();
                            s.startTime = i;
                            s.endTime = i+1;
                            s.start = arcXToPhigrosLine(ArcaeaEasing.resolveX(event.start.x, event.end.x, pA, event.lineType));
                            s.end = arcXToPhigrosLine(ArcaeaEasing.resolveX(event.start.x, event.end.x, pB, event.lineType));
                            s.start2 = s.end2 = 0.15;
                            voidLine.judgeLineMoveEvents.push(s);

                            var r = new StateEvent();
                            r.startTime = i;
                            r.endTime = i+1;
                            r.start = r.end = 90 - (s.end - s.start) * 180;
                            voidLine.judgeLineRotateEvents.push(r);

                            var a2 = new StateEvent();
                            a2.startTime = i;
                            a2.endTime = i+1;
                            a2.start = arcYToPhigrosAlpha(ArcaeaEasing.resolveY(event.start.y, event.end.y, pA, event.lineType));
                            a2.end = arcYToPhigrosAlpha(ArcaeaEasing.resolveY(event.start.y, event.end.y, pB, event.lineType));
                            voidLine.judgeLineDisappearEvents.push(a2);
                        }

                        var a3 = new StateEvent();
                        a3.startTime = bTime;
                        a3.endTime = 99999999;
                        a3.start = a3.end = 0;
                        voidLine.judgeLineDisappearEvents.push(a3);

                        event.arcTaps.forEach(t => {
                            var progress = (arcTimeToPhigros(t.time, baseBPM) - aTime) / (bTime - aTime);

                            var flick = new FlickNote();
                            flick.time = arcTimeToPhigros(t.time, baseBPM);
                            maxTime = Math.max(maxTime, flick.time);
                            flick.positionX = arcXToPhigros(ArcaeaEasing.resolveX(event.start.x, event.end.x, progress, event.lineType));
                            flick.parent = arcLine;
                            arcLine.notesAbove.push(flick);
                        })
                    }
                }
            });

            [].push.apply(chart.judgeLineList, voidLines);

            [notesLine, arcLine].forEach(ln => {
                [ln.notesAbove, ln.notesBelow].forEach(arr => {
                    arr.forEach(n => {
                        n.floorPosition = getFloorPosition(n.time);
                    });
                });
            });
        });

        chart.solveSiblings();
        return chart;
    }
}
