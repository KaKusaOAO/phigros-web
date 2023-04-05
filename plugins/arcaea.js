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
    constructor(isPrimary, args = "") {
        this.isPrimary = isPrimary;
        this.args = args.split("_");

        /** @type {ArcaeaEvent[]} */
        this.events = [];
    }

    getBaseBPM() {
        return this.events.find(n => {
            return n instanceof ArcaeaTimingEvent;
        }).bpm;
    }

    isNoInput() {
        return this.args.indexOf("noinput") != -1;
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

class ArcaeaSceneControlEvent extends ArcaeaEvent {
    /**
     * 
     * @param {number} time 
     * @param {string} type 
     * @param {number[]} args
     */
    constructor(time, type, args) {
        super(time);
        this.type = type;
        this.args = args;
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
        var chart = ArcaeaChart.deserialize(await (await fetch(`${basePath}/${diff}.aff`, { cache: "no-cache" })).text());
        game.chart = Chart.fromArcaea(chart, arcDensity, speedMultiplier);
        await game.loadAudio(`${basePath}/base.ogg`);
    }

    static async loadFromDLC(name, diff, arcDensity = 1, speedMultiplier = 1) {
        var chart = ArcaeaChart.deserialize(await (await fetch(`/arcaea/assets/charts/dl/${name}_${diff}`, { cache: "no-cache" })).text());
        game.chart = Chart.fromArcaea(chart, arcDensity, speedMultiplier);
        await game.loadAudio(`/arcaea/assets/charts/dl/${name}`);
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
                line = line.trim();
                if(line.startsWith("timinggroup(")) {
                    var group = new ArcaeaTimingGroup(false, line.substring("timinggroup(".length, line.indexOf(")")));
                    chart.timingGroups.push(group);
                    targetGroup = group;
                    console.group("TimingGroup:", group);
                } else if(line.startsWith("};")) {
                    targetGroup = primaryGroup;
                    console.groupEnd();
                } else if(line.startsWith("timing(")) {
                    var event = line.substring("timing(".length, line.length - 2).split(",");
                    let ev = new ArcaeaTimingEvent(
                        parseFloat(event[0]), parseFloat(event[1]), parseFloat(event[2])
                    );
                    targetGroup.events.push(ev);
                    console.log("Timing: ", ev);
                } else if(line.startsWith("(")) {
                    // Single Note
                    var event = line.substring(1, line.length - 2).split(",");
                    let ev = new ArcaeaTapEvent(
                        parseFloat(event[0]), parseFloat(event[1]),
                    );
                    targetGroup.events.push(ev);
                    console.log("Tap: ", ev);
                } else if(line.startsWith("arc(")) {
                    let ev = ArcaeaArcEvent.readLine(line);
                    targetGroup.events.push(ev);
                    console.log("Arc: ", ev);
                } else if(line.startsWith("hold(")) {
                    // Single Hold note
                    var event = line.substring("hold(".length, line.length - 2).split(",");
                    let ev = new ArcaeaHoldEvent(
                        parseFloat(event[0]), parseFloat(event[1]), parseFloat(event[2])
                    );
                    targetGroup.events.push(ev);
                    console.log("Hold: ", ev);
                } else if (line.startsWith("camera")) {
                    // Don't handle camera events
                } else if (line.startsWith("scenecontrol")) {
                    var event = line.substring("scenecontrol(".length, line.length - 2).split(",");
                    var time = parseInt(event.shift());
                    var type = event.shift();
                    var args = event.map(o => parseFloat(o));
                    
                    let ev = new ArcaeaSceneControlEvent(time, type, args);
                    targetGroup.events.push(ev);
                    console.log("SceneControl: ", ev);
                } else {
                    console.warn("Unhandled line: ", line);
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
        console.log("Loading from Arcaea chart:", arcaea);
        var chart = new Chart();
        chart.offset = arcaea.offset * -0.001;
        var baseBPM = arcaea.getPrimaryGroup().getBaseBPM();

        arcaea.timingGroups.forEach(g => {
            // Don't handle no-input timing groups yet
            // if (g.isNoInput()) return;
            g.events.sort((a, b) => a.time - b.time);

            var arcLine = new JudgeLine();
            var notesLine = new JudgeLine();
    
            arcLine.bpm = baseBPM;
            notesLine.bpm = baseBPM;

            if (g.isNoInput()) {
                arcLine.noInput = true;
                notesLine.noInput = true;
            }
    
            var s1 = new StateEvent();
            s1.startTime = 0;
            s1.endTime = 99999999;
            s1.start = s1.end = 0.5;
            s1.start2 = s1.end2 = 0.15;
    
            var s2 = new StateEvent();
            s2.startTime = 0;
            s2.endTime = 99999999;
            s2.start = s2.end = 0.5;
            s2.start2 = s2.end2 = 0.15;

            var a1 = new StateEvent();
            a1.startTime = 0;
            a1.endTime = 99999999;
            a1.start = a1.end = 1;
            a1.start2 = a1.end2 = 0;
            
            arcLine.judgeLineMoveEvents.push(s1);
            notesLine.judgeLineMoveEvents.push(s2);

            arcLine.judgeLineDisappearEvents.push(a1);
            notesLine.judgeLineDisappearEvents.push(a1);

            chart.judgeLineList.push(arcLine, notesLine);
        
            var speeds = [
                { time: -1, endTime: 99999999, speed: 1, beatsPerLine: 4 }
            ];
            var maxTime = 0;

            g.events.filter(ev => ev instanceof ArcaeaTimingEvent).forEach(event => {
                var speed = event.bpm / baseBPM;
                speeds[speeds.length - 1].endTime = arcTimeToPhigros(event.time, baseBPM);
                speeds.push(
                    { time: arcTimeToPhigros(event.time, baseBPM), endTime: 99999999, speed, beatsPerLine: event.beatsPerLine }
                );
                maxTime = Math.max(maxTime, arcTimeToPhigros(event.time, baseBPM));
            });

            speeds.sort((a, b) => a.time - b.time);
            speeds.forEach((s, i) => {
                if(i == 0) return;
                
                var sa = new SpeedEvent();
                sa.startTime = s.time;
                sa.endTime = s.endTime;
                sa.value = s.speed * 1.25 * speedMultiplier;
                
                var sn = new SpeedEvent();
                sn.startTime = s.time;
                sn.endTime = s.endTime;
                sn.value = s.speed * 1.25 * speedMultiplier;

                arcLine.speedEvents.push(sa);
                notesLine.speedEvents.push(sn);
            });

            arcLine.recalculateSpeedEventsFloorPosition();
            notesLine.recalculateSpeedEventsFloorPosition();

            let getFloorPosition = time => {
                return notesLine.getCalculatedFloorPosition(time) * 0.6;
            };
            
            let getSpeed = time => {
                var event = notesLine.speedEvents.find(e => {
                    return time >= e.startTime && time < e.endTime;
                });
                if(event == null) event = notesLine.speedEvents[0];
                if(event == null) return speedMultiplier;

                return event.value;
            };

            /** @type {JudgeLine[]} */
            var voidLines = [];
            g.events.forEach(event => {
                if (event instanceof ArcaeaTapEvent) {
                    var tap = new TapNote();
                    tap.time = arcTimeToPhigros(event.time, baseBPM);
                    maxTime = Math.max(maxTime, tap.time);
                    tap.positionX = laneToX(event.lane);
                    tap.parent = notesLine;
                    notesLine.notesAbove.push(tap);
                } else if (event instanceof ArcaeaHoldEvent) {
                    var hold = new HoldNote();
                    hold.time = arcTimeToPhigros(event.time, baseBPM);
                    hold.holdTime = arcTimeToPhigros(event.endTime - event.time, baseBPM);
                    maxTime = Math.max(maxTime, hold.time + hold.holdTime);
                    hold.positionX = laneToX(event.lane);
                    hold.parent = notesLine;
                    hold.speed = getSpeed(hold.time);
                    notesLine.notesAbove.push(hold);
                } else if (event instanceof ArcaeaSceneControlEvent) {
                    if (event.type == "hidegroup") {
                        var hidden = event.args[1] == 0;
                        var y0 = hidden ? 2 : 0.15;
                        var y = hidden ? 0.15 : 2;
                        var x0 = 0.5; // hidden ? 100 : 0.5;
                        var x = 0.5; // hidden ? 0.5 : 100;

                        var ev = new StateEvent();
                        ev.startTime = ev.endTime = arcTimeToPhigros(event.time, baseBPM);
                        ev.endTime += 0.01;
                        ev.start = x0;
                        ev.start2 = y0;
                        ev.end = x;
                        ev.end2 = y;

                        var ev2 = new StateEvent();
                        ev2.startTime = ev.endTime;
                        ev2.start = x;
                        ev2.start2 = y;
                        ev2.end = x;
                        ev2.end2 = y;

                        var l = notesLine.judgeLineMoveEvents.slice(-1)[0];
                        ev2.endTime = l.endTime;
                        l.endTime = ev.startTime;

                        l = arcLine.judgeLineMoveEvents.slice(-1)[0];
                        l.endTime = ev.startTime;
                        
                        notesLine.judgeLineMoveEvents.push(ev, ev2);
                        arcLine.judgeLineMoveEvents.push(ev, ev2);
                    }
                } else if (event instanceof ArcaeaArcEvent) {
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

                        for(var i = aTime; i < bTime; i += density) {
                            density = arcDensity * getSpeed(i);
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
                        
                        // Avoid creating a new line for *every* void arcs!
                        // Reuse old ones when applicable.
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
                            var pB = (Math.min(i+1, bTime) - aTime) / (bTime - aTime);

                            var s = new StateEvent();
                            s.startTime = i;
                            s.endTime = Math.min(i+1, bTime);
                            s.start = arcXToPhigrosLine(ArcaeaEasing.resolveX(event.start.x, event.end.x, pA, event.lineType));
                            s.end = arcXToPhigrosLine(ArcaeaEasing.resolveX(event.start.x, event.end.x, pB, event.lineType));
                            s.start2 = s.end2 = 0.15;
                            voidLine.judgeLineMoveEvents.push(s);

                            var r = new StateEvent();
                            r.startTime = i;
                            r.endTime = Math.min(i+1, bTime);
                            r.start = r.end = 90 - (s.end - s.start) * 180;
                            voidLine.judgeLineRotateEvents.push(r);

                            var a2 = new StateEvent();
                            a2.startTime = i;
                            a2.endTime = Math.min(i+1, bTime);
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

            var beatLines = [];
            speeds.forEach((ev, i) => {
                if (i == 0) return;
                var isLast = i == speeds.length - 1;

                if (g.isPrimary) {
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

                        beatLines.push(line);
                    }                        
                }
            });

            // Merge the beat lines
            for (var i = 1; i < beatLines.length; i++) {
                /** @type {JudgeLine} */
                var line = beatLines[i];

                // We are looking for a target to merge into.
                // The target should:
                // - Have disappeared before `line` appears.
                var target = beatLines.find((l, j) => {
                    if (j > i) return false;
                    
                    var events = l.judgeLineDisappearEvents;
                    var lastEvent = events[events.length - 1];
                    if (!lastEvent) return false;

                    // The time it disappears, that time `line` is out of range
                    var dt = l.getRealTime(lastEvent.startTime);
                    var y = line.getLinePosition(dt).y;
                    if (y > 1 || y < 0) {
                        return true;
                    }

                    return false;
                });

                if (target != null) {
                    // Alpha
                    var de = target.judgeLineDisappearEvents;
                    var dl = de.slice(-2);
                    
                    var del = line.judgeLineDisappearEvents;
                    var dell = del.slice(-1)[0];

                    dl[0].endTime = dl[1].startTime = dell.startTime;

                    // Position
                    var pe = target.judgeLineMoveEvents;
                    var pel = pe.slice(-1)[0];

                    var lpe = line.judgeLineMoveEvents;
                    var et = pel.endTime;
                    var lpel = lpe.filter(e => e.endTime >= et);
                    if (lpel.length > 0) {
                        lpel[0].start2 = line.getLinePosition(target.getRealTime(et)).y;
                        lpel[0].startTime = et;
                        pe.push(...lpel);
                    } else {
                        console.warn("lpel is empty??")
                    }

                    beatLines.splice(i, 1);
                    i--;
                }
            }

            [].push.apply(chart.judgeLineList, voidLines);
            [].push.apply(chart.judgeLineList, beatLines);
            console.log("Beatlines: ", beatLines);
        });

        chart.solveSiblings();

        var maxTime = Math.max(...chart.judgeLineList
            .flatMap(l => [l.notesAbove, l.notesBelow]
                .flatMap(arr => arr.map(n => n.time))));

        // Do some post-processing
        chart.judgeLineList.forEach((line, i) => {
            line.index = i;

            // Sort the events so we can use binary search
            line.judgeLineDisappearEvents.sort((a, b) => a.startTime - b.startTime);
            line.judgeLineRotateEvents.sort((a, b) => a.startTime - b.startTime);
            line.judgeLineMoveEvents.sort((a, b) => a.startTime - b.startTime);
        });

        // Handle no-input lines
        chart.judgeLineList.filter(l => l.noInput).forEach(l => {
            l.recalculateNotesFloorPosition();

            var clone = [...l.speedEvents].map(e => {
                var c = new SpeedEvent()
                c.startTime = e.startTime;
                c.endTime = e.endTime;
                c.value = e.value;
                c.floorPosition = e.floorPosition;
                return c;
            });

            clone.forEach(e => {
                e.startTime += maxTime + 1;
                e.endTime += maxTime + 1;
            });

            var lsp = l.speedEvents.slice(-1)[0];
            lsp.endTime = maxTime;

            var sp2 = new SpeedEvent();
            sp2.startTime = maxTime;
            sp2.endTime = maxTime + 1;
            sp2.value = 1;

            l.speedEvents.push(sp2);
            l.speedEvents.push(...clone);
            l.recalculateSpeedEventsFloorPosition();

            var spf = sp2.floorPosition;
            sp2.value = -spf / 1.875 * l.bpm;
            l.recalculateSpeedEventsFloorPosition();

            var sp = l.speedEvents.slice(-1)[0];
            var notes = [...l.notesAbove, ...l.notesBelow];
            notes.forEach(n => {
                var f = n.floorPosition;
                var t = ((f - sp.floorPosition) / sp.value * 1000 * l.bpm / 1875) + sp.startTime;
                n.time = t;
            });

            l.speedEvents.slice(-1)[0].endTime = 99999999;
        });

        chart.recalculateFloorPosition();

        return chart;
    }
}
